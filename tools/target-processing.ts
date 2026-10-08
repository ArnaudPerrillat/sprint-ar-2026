// In-browser equivalent of scripts/build-targets.ts (which wraps @8thwall/image-target-cli):
// same default 3:4 crop, same files and JSON, so the result can be dropped into experience/target/.
// Nothing leaves the browser.
//
// CLI reference (src/apply.js, src/crop.js of @8thwall/image-target-cli 1.0.0):
// - landscape posters are rotated 90° clockwise, then cropped (isRotated: true)
// - default crop = the largest centred 3:4 portrait rectangle
// - thumbnail = crop resized to 350 px high, luminance = crop resized to 640 px high, grayscale
// - minimum crop size 480 × 640

export const MIN_WIDTH = 480
export const MIN_HEIGHT = 640
const THUMBNAIL_HEIGHT = 350
const LUMINANCE_HEIGHT = 640
const POSTER_MAX = 2048

export interface Crop {
  top: number
  left: number
  width: number
  height: number
  isRotated: boolean
  originalWidth: number
  originalHeight: number
}

export interface Trackability {
  corners: number
  contrast: number
  emptyCells: number
  level: 'bon' | 'moyen' | 'faible'
  advice: string[]
}

export interface ProcessedTarget {
  name: string
  crop: Crop
  // Share of the poster inside the tracked 3:4 zone, 0..1.
  trackedShare: number
  score: Trackability
  files: {name: string; data: Uint8Array}[]
  json: Record<string, unknown>
  luminance: ImageData
  previewUrl: string
}

// "Prénom Nom.png" -> "prenom-nom"
export const slug = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'affiche'

// Same as getDefaultCrop() in the CLI.
export const defaultCrop = (width: number, height: number): Crop => {
  const isRotated = width > height
  const [w, h] = isRotated ? [height, width] : [width, height]
  if (w / 3 > h / 4) {
    const cw = Math.round((h * 3) / 4)
    return {left: Math.round((w - cw) / 2), top: 0, width: cw, height: h, isRotated, originalWidth: w, originalHeight: h}
  }
  const ch = Math.round((w * 4) / 3)
  return {left: 0, top: Math.round((h - ch) / 2), width: w, height: ch, isRotated, originalWidth: w, originalHeight: h}
}

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const ctx = c.getContext('2d', {willReadFrequently: true})!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return {c, ctx}
}

const toJpeg = (c: HTMLCanvasElement, quality: number): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    c.toBlob(async (blob) => {
      if (!blob) return reject(new Error('encodage JPEG impossible'))
      resolve(new Uint8Array(await blob.arrayBuffer()))
    }, 'image/jpeg', quality)
  })

// Downscale in halving steps: much closer to a proper resampling than one big drawImage.
const resizeTo = (source: HTMLCanvasElement, height: number): HTMLCanvasElement => {
  let current = source
  while (current.height / 2 > height) {
    const step = canvas(current.width / 2, current.height / 2)
    step.ctx.drawImage(current, 0, 0, step.c.width, step.c.height)
    current = step.c
  }
  const out = canvas((current.width * height) / current.height, height)
  out.ctx.drawImage(current, 0, 0, out.c.width, out.c.height)
  return out.c
}

const toGray = (c: HTMLCanvasElement): HTMLCanvasElement => {
  const ctx = c.getContext('2d', {willReadFrequently: true})!
  const img = ctx.getImageData(0, 0, c.width, c.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = y
  }
  ctx.putImageData(img, 0, 0)
  return c
}

// Port of scripts/lib/trackability.ts (same thresholds, calibrated on the demo posters).
export const scoreTrackability = (img: ImageData): Trackability => {
  const {width: w, height: h, data} = img
  const gray = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) gray[i] = data[i * 4]
  const cells = 8
  const perCell = new Array(cells * cells).fill(0)
  let corners = 0
  let sum = 0
  let sum2 = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      sum += gray[i]
      sum2 += gray[i] * gray[i]
      const gx = gray[i + 1] - gray[i - 1]
      const gy = gray[i + w] - gray[i - w]
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
  if (corners < 18000) advice.push('pas assez de détails nets : ajoute du texte, des contours, des formes variées')
  if (emptyCells > 12) advice.push(`${emptyCells}/64 zones presque vides : répartis les détails sur toute l'affiche`)
  if (contrast < 50) advice.push('contraste faible en noir et blanc (le moteur ne voit pas les couleurs) : renforce les foncés')
  const level = corners >= 18000 && emptyCells <= 12 ? 'bon' : corners >= 12000 ? 'moyen' : 'faible'
  return {corners, contrast, emptyCells, level, advice}
}

// 0 = unrelated, 1 = identical (normalised correlation of 48×64 thumbnails).
export const similarity = (a: ImageData, b: ImageData): number => {
  const small = (img: ImageData) => {
    const src = canvas(img.width, img.height)
    src.ctx.putImageData(img, 0, 0)
    const dst = canvas(48, 64)
    dst.ctx.drawImage(src.c, 0, 0, 48, 64)
    const d = dst.ctx.getImageData(0, 0, 48, 64).data
    return Array.from({length: 48 * 64}, (_, i) => d[i * 4])
  }
  const x = small(a)
  const y = small(b)
  const mx = x.reduce((s, v) => s + v, 0) / x.length
  const my = y.reduce((s, v) => s + v, 0) / y.length
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

export const processPoster = async (file: File, name: string): Promise<ProcessedTarget> => {
  let bitmap: ImageBitmap
  try {
    // EXIF orientation applied, like sharp().rotate() in build-targets.
    bitmap = await createImageBitmap(file, {imageOrientation: 'from-image'})
  } catch {
    throw new Error('ce fichier n\'est pas une image lisible (utilise un PNG ou un JPG)')
  }
  const W = bitmap.width
  const H = bitmap.height
  const crop = defaultCrop(W, H)
  if (crop.width < MIN_WIDTH || crop.height < MIN_HEIGHT) {
    throw new Error(`image trop petite (${W}×${H} px) : il faut au moins ${MIN_WIDTH}×${MIN_HEIGHT} px dans la zone suivie ; exporte ton affiche en plus grand (1500 px de large ou plus)`)
  }

  // White background (transparent PNGs), upright.
  const upright = canvas(W, H)
  upright.ctx.fillStyle = '#ffffff'
  upright.ctx.fillRect(0, 0, W, H)
  upright.ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  // The CLI works on the image rotated 90° clockwise for landscape posters.
  let work = upright.c
  if (crop.isRotated) {
    const r = canvas(H, W)
    r.ctx.translate(H, 0)
    r.ctx.rotate(Math.PI / 2)
    r.ctx.drawImage(upright.c, 0, 0)
    work = r.c
  }
  const cropped = canvas(crop.width, crop.height)
  cropped.ctx.drawImage(work, crop.left, crop.top, crop.width, crop.height, 0, 0, crop.width, crop.height)

  const thumbnail = resizeTo(cropped.c, THUMBNAIL_HEIGHT)
  const luminance = toGray(resizeTo(cropped.c, LUMINANCE_HEIGHT))
  const posterScale = Math.min(1, POSTER_MAX / Math.max(W, H))
  const poster = posterScale < 1 ? resizeTo(upright.c, Math.round(H * posterScale)) : upright.c

  const resources = {
    originalImage: `${name}_original.jpg`,
    croppedImage: `${name}_cropped.jpg`,
    thumbnailImage: `${name}_thumbnail.jpg`,
    luminanceImage: `${name}_luminance.jpg`,
    posterImage: `${name}_poster.jpg`,
  }
  const now = Date.now()
  const json = {
    imagePath: `image-targets/${resources.luminanceImage}`,
    metadata: null,
    name,
    type: 'PLANAR',
    properties: crop,
    resources,
    created: now,
    updated: now,
  }

  const lumData = luminance.getContext('2d')!.getImageData(0, 0, luminance.width, luminance.height)
  const files = [
    {name: resources.luminanceImage, data: await toJpeg(luminance, 0.9)},
    {name: resources.thumbnailImage, data: await toJpeg(thumbnail, 0.9)},
    {name: resources.posterImage, data: await toJpeg(poster, 0.82)},
  ]
  const preview = resizeTo(upright.c, Math.min(H, 520))
  return {
    name,
    crop,
    trackedShare: (crop.width * crop.height) / (W * H),
    score: scoreTrackability(lumData),
    files,
    json,
    luminance: lumData,
    previewUrl: preview.toDataURL('image/jpeg', 0.8),
  }
}
