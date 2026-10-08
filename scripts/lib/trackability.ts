// Rough "how well will this poster be detected" score, computed on the luminance image the engine
// uses (always 640 px high). Calibrated on the demo assets: the single demo poster scores ~24 600
// corners and is detected instantly; a first puzzle version at 7 700–11 000 corners made of one
// repeated motif was detected very slowly on Android.

import sharp from 'sharp'

export interface Trackability {
  corners: number
  contrast: number
  // Cells of an 8×8 grid with almost no detail.
  emptyCells: number
  level: 'bon' | 'moyen' | 'faible'
  advice: string[]
}

const GOOD = 18000
const WEAK = 12000

export const scoreTrackability = async (file: string): Promise<Trackability> => {
  const {data, info} = await sharp(file).grayscale().raw().toBuffer({resolveWithObject: true})
  const {width: w, height: h} = info
  const cells = 8
  const perCell = new Array(cells * cells).fill(0)
  let corners = 0
  let sum = 0
  let sum2 = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      sum += data[i]
      sum2 += data[i] * data[i]
      const gx = data[i + 1] - data[i - 1]
      const gy = data[i + w] - data[i - w]
      if (Math.abs(gx) > 40 && Math.abs(gy) > 40) {
        corners++
        perCell[Math.min(cells - 1, Math.floor((y / h) * cells)) * cells + Math.min(cells - 1, Math.floor((x / w) * cells))]++
      }
    }
  }
  const n = (w - 2) * (h - 2)
  const mean = sum / n
  const contrast = Math.sqrt(Math.max(0, sum2 / n - mean * mean))
  const emptyCells = perCell.filter((c) => c < 15).length

  const advice: string[] = []
  if (corners < GOOD) advice.push('pas assez de détails nets : ajoute du texte, des contours, des formes variées')
  if (emptyCells > 12) advice.push(`${emptyCells}/64 zones presque vides : répartis les détails sur toute l'affiche`)
  if (contrast < 50) advice.push('contraste faible en noir et blanc (le moteur ne voit pas les couleurs) : renforce les foncés')
  const level = corners >= GOOD && emptyCells <= 12 ? 'bon' : corners >= WEAK ? 'moyen' : 'faible'
  return {corners, contrast, emptyCells, level, advice}
}

// Similarity of two luminance images (0 = unrelated, 1 = identical), on small thumbnails.
export const similarity = async (a: string, b: string): Promise<number> => {
  const load = async (f: string) =>
    (await sharp(f).grayscale().resize(48, 64, {fit: 'fill'}).raw().toBuffer()) as Buffer
  const [x, y] = await Promise.all([load(a), load(b)])
  const mean = (v: Buffer) => v.reduce((s, n) => s + n, 0) / v.length
  const mx = mean(x)
  const my = mean(y)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my)
    dx += (x[i] - mx) ** 2
    dy += (y[i] - my) ** 2
  }
  return dx && dy ? Math.max(0, num / Math.sqrt(dx * dy)) : 0
}
