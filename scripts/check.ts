// npm run check  -> checks experience/ before publishing. Never blocks (exit code 0) unless --strict.
//   - experience.json: JSON syntax + schema (same rules as the app)
//   - every referenced file exists (assets, behaviors, target)
//   - weight budget (15 MB), video resolution (720p max), image size (2048 px max)
//   - behaviors: JavaScript syntax, and code that leaves the frame (network, DOM outside ctx.ui,
//     Deezer without experience/API.md)
//   - core/ fingerprint
// Usage: npm run check [-- examples/02-video] [-- --strict]

import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {join, relative, extname} from 'node:path'
import {execFileSync} from 'node:child_process'
import sharp from 'sharp'
import {brickSound, parseJsonText, validateExperience, type Brick} from '../core/schema/schema.ts'
import {isCoreIntact, readSealedHash} from './lib/core-hash.ts'

const BUDGET_MB = 15
const MAX_IMAGE_PX = 2048
const MAX_VIDEO_LONG = 1280
const MAX_VIDEO_SHORT = 720

const root = process.cwd()
const args = process.argv.slice(2)
const strict = args.includes('--strict')
const expDir = join(root, 'experience')
const configDir = join(root, args.find((a) => !a.startsWith('--')) ?? 'experience')

let errors = 0
let warnings = 0
const error = (msg: string) => {
  errors++
  console.log(`  ✖ ${msg}`)
}
const warn = (msg: string) => {
  warnings++
  console.log(`  ⚠ ${msg}`)
}
const ok = (msg: string) => console.log(`  ✔ ${msg}`)
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1)

const listFiles = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((name) => {
      const full = join(dir, name)
      return statSync(full).isDirectory() ? listFiles(full) : [full]
    })
    : []

// Width/height of an MP4/MOV from its 'tkhd' boxes (no dependency needed).
const mp4Size = (file: string): {width: number; height: number} | null => {
  const buf = readFileSync(file)
  let best: {width: number; height: number} | null = null
  let i = buf.indexOf('tkhd')
  while (i !== -1) {
    const version = buf[i + 4]
    const base = i + 8 + (version === 1 ? 32 : 20) + 8 + 2 + 2 + 2 + 2 + 36
    if (base + 8 <= buf.length) {
      const width = buf.readUInt32BE(base) / 65536
      const height = buf.readUInt32BE(base + 4) / 65536
      if (width && height && (!best || width * height > best.width * best.height)) best = {width, height}
    }
    i = buf.indexOf('tkhd', i + 4)
  }
  return best
}

const videoSize = (file: string): {width: number; height: number} | null => {
  try {
    const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'})
    const [width, height] = out.trim().split(',').map(Number)
    if (width && height) return {width, height}
  } catch {
    // ffprobe not installed: fall back on the MP4 parser.
  }
  return /\.(mp4|m4v|mov)$/i.test(file) ? mp4Size(file) : null
}

// Behaviors are plain modules: nothing stops them technically. These warnings show the teacher
// (and the AI agent) when one leaves the frame of RULES.md § 4 / 4 bis.
const BEHAVIOR_RULES: [RegExp, string][] = [
  [/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b/, 'appel réseau direct : interdit (pour Deezer, ctx.deezer)'],
  [/api\.deezer\.com|\bDZ\.\w+/, 'appel Deezer à la main : utilise ctx.deezer(...)'],
  [/\bdocument\s*\.(body|head|documentElement|createElement|querySelector|getElementById|getElementsBy)/, 'accès direct à la page : passe par ctx.ui.panel(...) (createElement / querySelector sur le panneau, pas sur document)'],
  [/\.appendChild\s*\(\s*document\.createElement\s*\(\s*['"]style/, 'balise <style> ajoutée à la main : utilise ctx.ui.style(...)'],
  [/\bnew\s+(\w+\.)*(Scene|WebGLRenderer)\s*\(/, 'nouvelle scène ou nouveau renderer : ajoute tes objets à ctx.poster ou à une brique'],
]

const stripComments = (code: string): string =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[\s;{}()])\/\/.*$/gm, '$1')

const checkBehaviorScope = (name: string, source: string): void => {
  const code = stripComments(source)
  for (const [re, message] of BEHAVIOR_RULES) {
    if (re.test(code)) warn(`behavior « ${name} » : ${message}`)
  }
  for (const api of ['deezer', 'shared']) {
    if (new RegExp(`\\bctx\\.${api}\\b`).test(code) && !existsSync(join(configDir, 'API.md'))) {
      warn(`behavior « ${name} » utilise ctx.${api} sans ${relative(root, join(configDir, 'API.md'))} : demande l'autorisation à ton enseignant`)
    }
  }
  if (/\bctx\.shared\b/.test(code) && !experienceShared) {
    warn(`behavior « ${name} » utilise ctx.shared sans "shared" dans experience.json (l'identifiant est dans API.md)`)
  }
  if (/\bfirebase|firestore\.googleapis/i.test(code)) {
    warn(`behavior « ${name} » : accès direct à Firebase interdit, utilise ctx.shared`)
  }
}

let experienceShared: string | undefined

const assetsOf = (b: Brick): string[] => {
  const sound = brickSound(b)
  return [...brickAssets(b), ...(sound ? [sound.src] : [])]
}

const brickAssets = (b: Brick): string[] => {
  switch (b.type) {
    case 'layers':
      return b.layers.map((l) => l.src)
    case 'video':
    case 'model':
      return [b.src]
    case 'collection':
      return [
        ...b.pieces.flatMap((p) => (p.src ? [p.src] : [])),
        ...(b.reveal?.image ? [b.reveal.image] : []),
      ]
    default:
      return []
  }
}

const main = async () => {
  const label = relative(root, configDir) || '.'
  console.log(`\nVérification de ${label}/experience.json\n`)

  // 1. JSON + schema
  const jsonPath = join(configDir, 'experience.json')
  if (!existsSync(jsonPath)) {
    error(`${relative(root, jsonPath)} est introuvable`)
    return finish()
  }
  const {data, issue} = parseJsonText(readFileSync(jsonPath, 'utf8'))
  if (issue) {
    error(issue.message)
    return finish()
  }
  const {experience, issues} = validateExperience(data)
  experienceShared = experience.shared
  issues.forEach((i) => (i.level === 'error' ? error(i.message) : warn(i.message)))
  if (!issues.some((i) => i.level === 'error')) ok(`schéma valide (${experience.bricks.length} brique${experience.bricks.length > 1 ? 's' : ''})`)

  // 2. Referenced files
  const referenced = new Set<string>()
  for (const brick of experience.bricks) {
    for (const src of assetsOf(brick)) {
      referenced.add(src)
      const file = join(expDir, src)
      if (!existsSync(file)) {
        error(`brique « ${brick.id} » : le fichier experience/${src} n'existe pas`)
        continue
      }
      const ext = extname(file).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
        const meta = await sharp(file).metadata()
        if ((meta.width ?? 0) > MAX_IMAGE_PX || (meta.height ?? 0) > MAX_IMAGE_PX) {
          warn(`${src} fait ${meta.width}×${meta.height} px : réduis à ${MAX_IMAGE_PX} px max (plus léger, plus fluide sur téléphone)`)
        }
      }
      if (src === brickSound(brick)?.src && ext !== '.mp3') {
        warn(`${src} : utilise un fichier .mp3 (le seul format qui marche partout, iPhone compris)`)
      }
      if (brick.type === 'video' && src === brick.src) {
        const size = videoSize(file)
        if (!size) warn(`${src} : résolution non vérifiée (installe ffprobe, ou utilise du .mp4)`)
        else if (Math.max(size.width, size.height) > MAX_VIDEO_LONG || Math.min(size.width, size.height) > MAX_VIDEO_SHORT) {
          warn(`${src} est en ${size.width}×${size.height} : 720p maximum (1280×720), sinon ça rame sur téléphone`)
        } else ok(`${src} : ${size.width}×${size.height}`)
        if (ext === '.webm') warn(`${src} : le WebM ne marche pas sur iPhone, utilise du .mp4 (H.264)`)
      }
      if (brick.type === 'model' && src === brick.src && ext !== '.glb') warn(`${src} : utilise un fichier .glb (un seul fichier, textures incluses)`)
    }
  }
  if (/^assets\//.test(experience.theme.font) && !existsSync(join(expDir, experience.theme.font))) {
    error(`police : experience/${experience.theme.font} n'existe pas`)
  }

  // 3. Behaviors
  for (const name of experience.behaviors) {
    const file = join(configDir, 'behaviors', `${name}.js`)
    if (!existsSync(file)) {
      error(`behavior « ${name} » : ${relative(root, file)} n'existe pas`)
      continue
    }
    try {
      execFileSync(process.execPath, ['--check', file], {stdio: 'pipe'})
      ok(`behavior « ${name} » : syntaxe OK`)
    } catch (err) {
      const stderr = String((err as {stderr?: Buffer}).stderr ?? '')
      const line = stderr.split('\n').find((l) => /SyntaxError/.test(l)) ?? 'erreur de syntaxe'
      error(`behavior « ${name} » : ${line.trim()}`)
      continue
    }
    checkBehaviorScope(name, readFileSync(file, 'utf8'))
  }

  // 4. Targets (one, or one per poster with "targets")
  const engineNames = new Map<string, string>()
  for (const {id, file} of experience.targets ?? [{id: 'main', file: experience.target}]) {
    const label = experience.targets ? `cible « ${id} »` : 'cible'
    const targetJson = join(expDir, 'target', file)
    if (!existsSync(targetJson)) {
      error(`${label} : experience/target/${file} n'existe pas (demande le dossier de cible à ton enseignant)`)
      continue
    }
    try {
      const target = JSON.parse(readFileSync(targetJson, 'utf8'))
      const lum = target.resources?.luminanceImage
      if (!lum || !existsSync(join(expDir, 'target', lum))) error(`${label} : l'image ${lum ?? '(luminance)'} manque dans experience/target/`)
      else ok(`${label} : ${file} (« ${target.name} »)`)
      const other = engineNames.get(target.name)
      if (other) error(`les affiches « ${other} » et « ${id} » ont la même cible « ${target.name} »`)
      engineNames.set(target.name, id)
    } catch {
      error(`${label} : experience/target/${file} n'est pas un JSON valide`)
    }
  }
  if ((experience.targets?.length ?? 1) > 8) {
    warn(`${experience.targets!.length} affiches : au-delà de 8, le démarrage devient lent sur téléphone`)
  }

  // 5. Weight budget (whole experience/ folder, it is all published)
  const files = listFiles(expDir).map((f) => ({f, size: statSync(f).size}))
  const total = files.reduce((s, x) => s + x.size, 0)
  if (total > BUDGET_MB * 1024 * 1024) {
    warn(`experience/ pèse ${mb(total)} Mo (budget : ${BUDGET_MB} Mo). Les plus gros fichiers :`)
    files.sort((a, b) => b.size - a.size).slice(0, 5).forEach(({f, size}) => console.log(`      ${mb(size)} Mo  ${relative(root, f)}`))
  } else ok(`poids total : ${mb(total)} Mo / ${BUDGET_MB} Mo`)
  const unused = files
    .map(({f}) => relative(expDir, f).split('\\').join('/'))
    .filter((f) => f.startsWith('assets/') && !referenced.has(f) && f !== experience.theme.font)
  if (unused.length && configDir === expDir) {
    console.log(`  ℹ ${unused.length} fichier(s) dans assets/ non utilisé(s) par experience.json (ils sont quand même publiés)`)
  }

  // 6. core/
  if (!readSealedHash(root)) console.log('  ℹ core/ non scellé')
  else if (isCoreIntact(root)) ok('core/ intact')
  else warn('core/ a été modifié : préviens ton enseignant (l\'AR risque de ne plus marcher)')

  finish()
}

const finish = () => {
  console.log(`\n${errors ? `✖ ${errors} erreur(s)` : '✔ aucune erreur'}${warnings ? `, ${warnings} avertissement(s)` : ''}\n`)
  if (strict && errors) process.exitCode = 1
}

void main()
