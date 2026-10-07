// Batch image target generation (teacher tool).
//
//   npm run targets                         posters/*.png|jpg -> targets-out/<nom>/
//   npm run targets -- chemin/affiche.png   a single poster
//   npm run targets -- posters --out dossier
//   npm run targets -- affiche.png --into experience/target    write straight into a project
//   --crop top,left,width                   custom 3:4 crop (pixels of the upright poster)
//
// @8thwall/image-target-cli is interactive only (readline prompts, no flags). Its package has no
// "exports" map, so we call its internals directly: getDefaultCrop() (src/crop.js) and applyCrop()
// (src/apply.js), exactly as its interactive flow does for a flat target.
// Each output folder contains the CLI files plus:
//   target.json        the CLI's <nom>.json, renamed so the runtime always finds it
//   <nom>_poster.jpg   the upright poster for the camera-less preview

import sharp from 'sharp'
import {existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync} from 'node:fs'
import {basename, extname, join, resolve} from 'node:path'
import {applyCrop} from '@8thwall/image-target-cli/src/apply.js'
import {getDefaultCrop} from '@8thwall/image-target-cli/src/crop.js'

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp'])
const MIN_W = 480
const MIN_H = 640
const POSTER_MAX = 2048

const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  if (i === -1) return undefined
  const value = args[i + 1]
  args.splice(i, 2)
  return value
}
const outDir = resolve(flag('--out') ?? 'targets-out')
const intoDir = flag('--into')
const cropArg = flag('--crop')
const input = resolve(args[0] ?? 'posters')

// "Prénom Nom.png" -> "prenom-nom"
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const collect = (): string[] => {
  if (!existsSync(input)) {
    console.error(`✖ ${input} introuvable. Dépose les affiches (PNG/JPG) dans posters/ ou passe un chemin.`)
    process.exit(1)
  }
  if (statSync(input).isFile()) return [input]
  return readdirSync(input)
    .filter((f) => IMAGE_EXT.has(extname(f).toLowerCase()))
    .map((f) => join(input, f))
}

const buildOne = async (file: string) => {
  const name = slug(basename(file, extname(file)))
  const folder = intoDir ? resolve(intoDir) : join(outDir, name)
  // JPEG (white background) keeps the generated files light; EXIF orientation applied.
  const jpeg = await sharp(file).rotate().flatten({background: '#ffffff'}).jpeg({quality: 90}).toBuffer()
  const image = sharp(jpeg)
  const meta = await image.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const isLandscape = width > height

  if (Math.min(width, height) < MIN_W || Math.max(width, height) < MIN_H) {
    console.warn(`✖ ${name} : image trop petite (${width}×${height}, minimum ${MIN_W}×${MIN_H}).`)
    return
  }

  let geometry
  if (cropArg) {
    const [top, left, w] = cropArg.split(',').map(Number)
    if (isLandscape) {
      const h = w
      const cw = Math.round((h * 3) / 4)
      geometry = {top: left, left: height - top - cw, width: cw, height: h, isRotated: true, originalWidth: height, originalHeight: width}
    } else {
      geometry = {top, left, width: w, height: Math.round((w * 4) / 3), isRotated: false, originalWidth: width, originalHeight: height}
    }
  } else {
    // Same default as the CLI: centred 3:4 crop, rotated for landscape posters.
    geometry = getDefaultCrop({width, height}, isLandscape)
  }

  mkdirSync(folder, {recursive: true})
  for (const f of readdirSync(folder)) {
    if (/_(original|cropped|thumbnail|luminance|poster)\.(jpg|png|webp)$/.test(f) || f === 'target.json' || f === `${name}.json`) {
      rmSync(join(folder, f))
    }
  }
  const {dataPath} = await applyCrop(image, {type: 'PLANAR', geometry}, folder, name, true)

  // Upright poster for preview mode.
  const posterFile = `${name}_poster.jpg`
  await sharp(jpeg)
    .resize({width: POSTER_MAX, height: POSTER_MAX, fit: 'inside', withoutEnlargement: true})
    .jpeg({quality: 82})
    .toFile(join(folder, posterFile))

  const data = JSON.parse(readFileSync(dataPath, 'utf8'))
  data.resources.posterImage = posterFile
  writeFileSync(join(folder, 'target.json'), `${JSON.stringify(data, null, 2)}\n`)
  rmSync(dataPath)
  // The full-size original is not needed at runtime (the preview uses _poster.jpg): drop it.
  const original = join(folder, data.resources.originalImage)
  if (existsSync(original)) rmSync(original)

  const lost = Math.round((1 - (geometry.width * geometry.height) / (width * height)) * 100)
  console.log(`✔ ${name} → ${folder}  (zone trackée : ${100 - lost} % de l'affiche${lost ? `, ${lost} % hors cible` : ''})`)
}

const main = async () => {
  const files = collect()
  if (!files.length) {
    console.error('✖ Aucune image PNG/JPG trouvée.')
    process.exit(1)
  }
  if (intoDir && files.length > 1) {
    console.error('✖ --into ne marche qu\'avec une seule affiche.')
    process.exit(1)
  }
  for (const file of files) {
    try {
      await buildOne(file)
    } catch (err) {
      console.error(`✖ ${basename(file)} : ${(err as Error).message}`)
    }
  }
  if (!intoDir) console.log(`\nCopie le contenu de targets-out/<nom>/ dans experience/target/ du projet de l'étudiant.`)
}

void main()
