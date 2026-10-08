// Generates the royalty-free demo assets (run once by the teacher, outputs are committed):
//   examples/affiche-demo.png            the printable demo poster (4 inks on paper)
//   experience/assets/demo/typon-*.png   one transparent film per ink
//   experience/assets/demo/fond-vert.mp4 green-screen video for the chroma key example (needs ffmpeg)
//   experience/assets/demo/totem.glb     animated 3D model
//   experience/assets/demo/boucle.wav    short sound loop
//
// Usage: npm run demo-assets

import sharp from 'sharp'
import {mkdirSync, writeFileSync, existsSync} from 'node:fs'
import {join} from 'node:path'
import {execFileSync} from 'node:child_process'
import * as THREE from 'three'
import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js'

const W = 1200
const H = Math.round(W * Math.SQRT2) // A-series ratio
const PAPER = '#f3efe6'
const INKS = [
  {name: 'jaune', color: '#ffcc00'},
  {name: 'rose', color: '#ff2d87'},
  {name: 'bleu', color: '#1d4bff'},
  {name: 'noir', color: '#141414'},
] as const

const root = process.cwd()
const assetsDir = join(root, 'experience', 'assets', 'demo')
mkdirSync(assetsDir, {recursive: true})
mkdirSync(join(root, 'examples'), {recursive: true})

// Seeded PRNG so the poster is reproducible.
let seed = 20261007
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const r = (a: number, b: number) => a + rand() * (b - a)

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`

// --- Ink 1: yellow, big organic blobs + halftone gradient -------------------------------------
const yellow = () => {
  const c = INKS[0].color
  let s = ''
  for (let i = 0; i < 5; i++) {
    const cx = r(100, W - 100)
    const cy = r(200, H - 300)
    const rad = r(120, 300)
    s += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${c}"/>`
  }
  // Halftone: dot size grows towards the bottom.
  for (let y = 40; y < H; y += 28) {
    for (let x = (y / 28) % 2 ? 14 : 28; x < W; x += 28) {
      const k = Math.pow(y / H, 1.6)
      const rad = 13 * k * (0.6 + 0.4 * Math.sin(x * 0.01 + y * 0.004))
      if (rad > 1.2) s += `<circle cx="${x}" cy="${y}" r="${rad.toFixed(1)}" fill="${c}"/>`
    }
  }
  return svg(s)
}

// --- Ink 2: pink, stars / triangles / strokes -------------------------------------------------
const pink = () => {
  const c = INKS[1].color
  let s = ''
  for (let i = 0; i < 26; i++) {
    const x = r(40, W - 40)
    const y = r(60, H - 60)
    const size = r(20, 110)
    const rot = r(0, 360)
    const kind = Math.floor(r(0, 3))
    if (kind === 0) {
      const pts = Array.from({length: 10}, (_, k) => {
        const a = (Math.PI / 5) * k
        const rr = k % 2 ? size * 0.42 : size
        return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`
      }).join(' ')
      s += `<polygon points="${pts}" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`
    } else if (kind === 1) {
      s += `<polygon points="${x},${y - size} ${x + size},${y + size} ${x - size},${y + size}" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`
    } else {
      s += `<rect x="${x - size}" y="${y - 9}" width="${size * 2}" height="18" rx="9" fill="${c}" transform="rotate(${rot} ${x} ${y})"/>`
    }
  }
  s += `<path d="M0 ${H * 0.62} Q ${W * 0.3} ${H * 0.52} ${W * 0.55} ${H * 0.64} T ${W} ${H * 0.6} L ${W} ${H * 0.67} Q ${W * 0.6} ${H * 0.72} ${W * 0.35} ${H * 0.66} T 0 ${H * 0.7} Z" fill="${c}"/>`
  return svg(s)
}

// --- Ink 3: blue, zigzags + grid of rings -----------------------------------------------------
const blue = () => {
  const c = INKS[2].color
  let s = ''
  for (let row = 0; row < 6; row++) {
    const y0 = 160 + row * 60
    let d = `M 60 ${y0}`
    for (let x = 60; x <= W - 60; x += 40) d += ` L ${x + 20} ${y0 + (row % 2 ? -22 : 22)} L ${x + 40} ${y0}`
    s += `<path d="${d}" fill="none" stroke="${c}" stroke-width="9" stroke-linejoin="round"/>`
  }
  for (let gy = 0; gy < 5; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      if (rand() < 0.35) continue
      const x = 130 + gx * 160 + (gy % 2) * 40
      const y = H * 0.73 + gy * 80
      if (y > H - 120) continue
      s += `<circle cx="${x}" cy="${y}" r="${r(14, 32)}" fill="none" stroke="${c}" stroke-width="${r(5, 12)}"/>`
    }
  }
  s += `<rect x="${W * 0.62}" y="${H * 0.36}" width="${W * 0.3}" height="${W * 0.3}" fill="${c}" transform="rotate(12 ${W * 0.77} ${H * 0.36 + W * 0.15})"/>`
  return svg(s)
}

// --- Ink 4: black, typography and print marks -------------------------------------------------
const black = () => {
  const c = INKS[3].color
  const font = 'Arial Black, Arial, Helvetica, sans-serif'
  let s = ''
  s += `<text x="60" y="${H * 0.47}" font-family="${font}" font-weight="900" font-size="210" fill="${c}" letter-spacing="-8">AFFICHE</text>`
  s += `<text x="60" y="${H * 0.47 + 190}" font-family="${font}" font-weight="900" font-size="210" fill="${c}" letter-spacing="-8">DÉMO</text>`
  s += `<text x="64" y="110" font-family="${font}" font-weight="700" font-size="40" fill="${c}">SÉRIGRAPHIE × RÉALITÉ AUGMENTÉE</text>`
  s += `<text x="64" y="${H - 70}" font-family="Arial, sans-serif" font-size="30" fill="${c}">WORKSHOP DNMADE 2 NUMÉRIQUE — 2026 — 4 COULEURS / 4 TYPONS</text>`
  // Small paragraph block (dense detail helps tracking).
  const words = 'encre trame racle cadre typon insolation émulsion repérage tirage séchage couleur papier aplat'.split(' ')
  for (let line = 0; line < 9; line++) {
    let text = ''
    while (text.length < 46) text += `${words[Math.floor(r(0, words.length))]} `
    s += `<text x="${W * 0.56}" y="${H * 0.8 + line * 26}" font-family="Arial, sans-serif" font-size="19" fill="${c}">${text.trim()}</text>`
  }
  // Barcode-like strip.
  let bx = 64
  while (bx < 480) {
    const bw = r(2, 9)
    s += `<rect x="${bx}" y="${H - 190}" width="${bw}" height="80" fill="${c}"/>`
    bx += bw + r(2, 8)
  }
  // Registration marks in the corners.
  for (const [x, y] of [[34, 34], [W - 34, 34], [34, H - 34], [W - 34, H - 34]]) {
    s += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="${c}" stroke-width="2"/>`
    s += `<path d="M ${x - 22} ${y} H ${x + 22} M ${x} ${y - 22} V ${y + 22}" stroke="${c}" stroke-width="2"/>`
  }
  return svg(s)
}

// --- Puzzle demo: one artwork cut into 2×2 posters ------------------------------------------
// Each piece also gets strong unique features (giant numeral, own pattern, own text) so the
// engine never confuses two pieces. Outputs examples/puzzle/piece-N.png (to build targets with
// `npm run targets -- examples/puzzle --group --into experience/target`) and the full picture.
const makePuzzle = async () => {
  const PW = W * 2
  const PH = H * 2
  const [Y, P, B, K] = INKS.map((i) => i.color)
  const font = 'Arial Black, Arial, Helvetica, sans-serif'
  let s = `<rect width="${PW}" height="${PH}" fill="${PAPER}"/>`
  // Shapes crossing the cuts, so the pieces visibly belong together.
  s += `<circle cx="${PW * 0.5}" cy="${PH * 0.5}" r="${PW * 0.3}" fill="${Y}"/>`
  s += `<path d="M0 ${PH * 0.18} L${PW} ${PH * 0.62} L${PW} ${PH * 0.72} L0 ${PH * 0.28} Z" fill="${B}" opacity="0.92"/>`
  s += `<circle cx="${PW * 0.5}" cy="${PH * 0.5}" r="${PW * 0.16}" fill="none" stroke="${P}" stroke-width="70"/>`
  s += `<text x="${PW / 2}" y="${PH * 0.53}" text-anchor="middle" font-family="${font}" font-size="300" fill="${K}" letter-spacing="-10">LE PROPOS</text>`
  // One pattern family per quarter.
  const quarters = [[0, 0], [1, 0], [0, 1], [1, 1]] as const
  quarters.forEach(([qx, qy], i) => {
    const x0 = qx * W
    const y0 = qy * H
    const clip = `clip-path="url(#q${i})"`
    s += `<clipPath id="q${i}"><rect x="${x0}" y="${y0}" width="${W}" height="${H}"/></clipPath>`
    let pattern = ''
    for (let k = 0; k < 260; k++) {
      const x = x0 + r(40, W - 40)
      const y = y0 + r(40, H - 40)
      const size = r(10, 34)
      if (i === 0) pattern += `<circle cx="${x}" cy="${y}" r="${size / 2}" fill="${P}"/>`
      else if (i === 1) pattern += `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${B}" transform="rotate(${r(0, 90)} ${x} ${y})"/>`
      else if (i === 2) pattern += `<path d="M${x - size} ${y} H${x + size} M${x} ${y - size} V${y + size}" stroke="${K}" stroke-width="7"/>`
      else pattern += `<polygon points="${x},${y - size} ${x + size},${y + size} ${x - size},${y + size}" fill="${P}"/>`
    }
    s += `<g ${clip}>${pattern}</g>`
    // Giant numeral in the outer corner of each piece.
    const nx = qx ? x0 + W - 80 : x0 + 80
    const ny = qy ? y0 + H - 90 : y0 + 560
    s += `<text x="${nx}" y="${ny}" text-anchor="${qx ? 'end' : 'start'}" font-family="${font}" font-size="560" fill="none" stroke="${K}" stroke-width="16">${i + 1}</text>`
    const ty = qy ? y0 + H - 90 : y0 + 120
    s += `<text x="${x0 + (qx ? 80 : W - 80)}" y="${ty}" text-anchor="${qx ? 'start' : 'end'}" font-family="Arial, sans-serif" font-weight="700" font-size="38" fill="${K}">PIÈCE ${i + 1}/4 — RETROUVE LES AUTRES</text>`
    let bx = x0 + (qx ? 80 : W - 480)
    const by = ty + (qy ? -160 : 30)
    const stop = bx + 400
    while (bx < stop) {
      const bw = r(3, 12)
      s += `<rect x="${bx}" y="${by}" width="${bw}" height="90" fill="${K}"/>`
      bx += bw + r(3, 10)
    }
  })
  const full = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}">${s}</svg>`)).png().toBuffer()
  const dir = join(root, 'examples', 'puzzle')
  mkdirSync(dir, {recursive: true})
  for (const [i, [qx, qy]] of quarters.entries()) {
    await sharp(full).extract({left: qx * W, top: qy * H, width: W, height: H}).png().toFile(join(dir, `piece-${i + 1}.png`))
  }
  await sharp(full).resize({width: 1000}).jpeg({quality: 82}).toFile(join(assetsDir, 'puzzle-complet.jpg'))
  console.log('✔ puzzle : 4 pièces dans examples/puzzle/ + assets/demo/puzzle-complet.jpg')
}

const main = async () => {
  if (process.argv.includes('--puzzle')) {
    await makePuzzle()
    return
  }
  const builders = [yellow, pink, blue, black]
  const films: Buffer[] = []
  for (let i = 0; i < INKS.length; i++) {
    const png = await sharp(Buffer.from(builders[i]())).png({compressionLevel: 9, palette: true}).toBuffer()
    films.push(png)
    writeFileSync(join(assetsDir, `typon-${i + 1}-${INKS[i].name}.png`), png)
  }
  // Poster = paper, each ink multiplied on top (like real overprinting).
  const poster = await sharp({create: {width: W, height: H, channels: 3, background: PAPER}})
    .composite(films.map((input) => ({input, blend: 'multiply' as const})))
    .png()
    .toBuffer()
  writeFileSync(join(root, 'examples', 'affiche-demo.png'), poster)
  console.log(`✔ affiche ${W}×${H} + ${INKS.length} typons`)

  makeVideo()
  await makeModel()
  makeSound()
}

const makeVideo = () => {
  const out = join(assetsDir, 'fond-vert.mp4')
  const font = existsSync('C:/Windows/Fonts/ariblk.ttf') ? 'C\\:/Windows/Fonts/ariblk.ttf' : ''
  const text = font
    ? `,drawtext=fontfile='${font}':text='RA!':fontsize=210:fontcolor=0x1d4bff:x=(w-tw)/2:y=(h-th)/2+50*sin(2*PI*t/2)`
    : ''
  try {
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'lavfi', '-i', 'color=c=0x00ff00:s=720x720:r=30:d=6',
      '-f', 'lavfi', '-i', "aevalsrc='0.2*sin(2*PI*(330+110*floor(mod(t*4,4)))*t)*exp(-6*mod(t,0.25))':d=6",
      '-vf',
      "drawbox=x='310+220*sin(2*PI*t/3)':y='310+220*cos(2*PI*t/3)':w=100:h=100:color=0xff2d87:t=fill," +
        "drawbox=x='330-200*sin(2*PI*t/2)':y='120':w=60:h=60:color=0xffcc00:t=fill" + text,
      '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-crf', '26',
      '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-shortest', out,
    ])
    console.log('✔ vidéo fond vert 720×720')
  } catch (err) {
    console.warn('✖ vidéo non générée (ffmpeg absent ?)', (err as Error).message)
  }
}

const makeModel = async () => {
  // GLTFExporter needs FileReader in binary mode: minimal Node polyfill.
  class NodeFileReader {
    result: ArrayBuffer | string | null = null
    onloadend: (() => void) | null = null
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then((b) => {
        this.result = b
        this.onloadend?.()
      })
    }
    readAsDataURL(blob: Blob) {
      void blob.arrayBuffer().then((b) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`
        this.onloadend?.()
      })
    }
  }
  ;(globalThis as unknown as {FileReader: unknown}).FileReader = NodeFileReader

  const group = new THREE.Group()
  group.name = 'totem'
  const mat = (color: string, roughness = 0.4) =>
    new THREE.MeshStandardMaterial({color, roughness, metalness: 0.05})
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.18, 48), mat(INKS[3].color, 0.7))
  base.position.y = 0.09
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.22, 0.07, 160, 20), mat(INKS[1].color))
  knot.name = 'noeud'
  knot.position.y = 0.55
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 2), mat(INKS[0].color, 0.3))
  ball.name = 'boule'
  ball.position.y = 0.98
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 16, 80), mat(INKS[2].color))
  ring.name = 'anneau'
  ring.position.y = 0.55
  ring.rotation.x = Math.PI / 2
  group.add(base, knot, ball, ring)

  const times = [0, 0.5, 1, 1.5, 2]
  const q = (deg: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(deg))
  const knotTrack = new THREE.QuaternionKeyframeTrack('noeud.quaternion', times,
    [0, 90, 180, 270, 360].flatMap((d) => q(d).toArray()))
  const ballTrack = new THREE.VectorKeyframeTrack('boule.position', times,
    [0.98, 1.18, 0.98, 1.18, 0.98].flatMap((y) => [0, y, 0]))
  const ringTrack = new THREE.VectorKeyframeTrack('anneau.scale', times,
    [1, 1.25, 1, 1.25, 1].flatMap((s) => [s, s, s]))
  const clip = new THREE.AnimationClip('danse', 2, [knotTrack, ballTrack, ringTrack])

  const exporter = new GLTFExporter()
  const glb = await exporter.parseAsync(group, {binary: true, animations: [clip]})
  writeFileSync(join(assetsDir, 'totem.glb'), Buffer.from(glb as ArrayBuffer))
  console.log('✔ modèle totem.glb (animation « danse »)')
}

const makeSound = () => {
  const rate = 22050
  const seconds = 4
  const n = rate * seconds
  const data = Buffer.alloc(44 + n * 2)
  const notes = [392, 440, 523.25, 587.33, 659.25, 587.33, 523.25, 440]
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const step = Math.floor(t * 2)
    const local = t - step / 2
    const f = notes[step % notes.length]
    const env = Math.exp(-5 * local)
    const v = 0.35 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t))
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), 44 + i * 2)
  }
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + n * 2, 4)
  data.write('WAVE', 8)
  data.write('fmt ', 12)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(rate, 24)
  data.writeUInt32LE(rate * 2, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(n * 2, 40)
  writeFileSync(join(assetsDir, 'boucle.wav'), data)
  console.log('✔ son boucle.wav')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
