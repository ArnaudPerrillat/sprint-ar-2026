// Poster inspector for cibles.html: shows what the tracking engine "sees" (grayscale luminance),
// the contrast points counted by the trackability score, and the empty cells of its 8×8 grid.
// Everything is drawn in one canvas, over the upright poster.

import {EMPTY_CELL, GRID_CELLS, type ProcessedTarget} from './target-processing'
import {icon} from './icons'

export type View = 'affiche' | 'vision' | 'points' | 'zones'

export const VIEWS: {id: View; label: string; legend: string}[] = [
  {
    id: 'affiche',
    label: 'Affiche',
    legend: 'Le cadre rose est la zone que le téléphone apprend à reconnaître (format 3:4). Le reste de l\'affiche peut quand même porter du contenu AR, mais il n\'aide pas à la retrouver.',
  },
  {
    id: 'vision',
    label: 'Vision du téléphone',
    legend: 'Voilà tout ce que le moteur garde de ton affiche : une petite image en niveaux de gris (480 × 640 px). Les couleurs disparaissent : deux couleurs différentes mais aussi claires l\'une que l\'autre deviennent le même gris.',
  },
  {
    id: 'points',
    label: 'Points d\'accroche',
    legend: 'Chaque point rose est un point d\'accroche : un endroit où le gris change brusquement dans les deux directions (coins, lettres, contours, textures). C\'est en les retrouvant dans l\'image de la caméra que le téléphone reconnaît l\'affiche. Les aplats et les dégradés doux n\'en donnent aucun.',
  },
  {
    id: 'zones',
    label: 'Zones vides',
    legend: 'L\'affiche est découpée en 8 × 8 zones. En rouge : les zones presque vides, où le téléphone n\'a rien à quoi s\'accrocher. Si on filme surtout cette partie, ou de près, la reconnaissance sera lente.',
  },
]

interface Assets {
  poster: HTMLImageElement
  luminance: HTMLCanvasElement
  dots: HTMLCanvasElement
}

const cache = new WeakMap<ProcessedTarget, Promise<Assets>>()

const loadAssets = (r: ProcessedTarget): Promise<Assets> => {
  let assets = cache.get(r)
  if (assets) return assets
  assets = (async () => {
    const poster = new Image()
    poster.src = r.previewUrl
    await poster.decode()
    const {width: w, height: h} = r.luminance
    const luminance = document.createElement('canvas')
    luminance.width = w
    luminance.height = h
    luminance.getContext('2d')!.putImageData(r.luminance, 0, 0)
    // One opaque pink pixel per counted contrast point, transparent elsewhere.
    const dots = document.createElement('canvas')
    dots.width = w
    dots.height = h
    const dctx = dots.getContext('2d')!
    const img = dctx.createImageData(w, h)
    const {mask} = r.score
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue
      img.data[i * 4] = 255
      img.data[i * 4 + 1] = 45
      img.data[i * 4 + 2] = 135
      img.data[i * 4 + 3] = 255
    }
    dctx.putImageData(img, 0, 0)
    return {poster, luminance, dots}
  })()
  cache.set(r, assets)
  return assets
}

// Upright poster size and tracked zone, in original pixels. The engine works on the poster rotated
// 90° clockwise when it is landscape ("work" space, where the crop is expressed).
const geometry = (r: ProcessedTarget) => {
  const c = r.crop
  const [W, H] = c.isRotated ? [c.originalHeight, c.originalWidth] : [c.originalWidth, c.originalHeight]
  const zone = c.isRotated
    ? {x: c.top, y: H - c.left - c.width, w: c.height, h: c.width}
    : {x: c.left, y: c.top, w: c.width, h: c.height}
  return {W, H, zone}
}

const draw = (canvas: HTMLCanvasElement, r: ProcessedTarget, a: Assets, view: View) => {
  const {W, H, zone} = geometry(r)
  const c = r.crop
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const cssWidth = canvas.getBoundingClientRect().width || 320
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round((canvas.width * H) / W)
  const k = canvas.width / W
  const ctx = canvas.getContext('2d')!

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(a.poster, 0, 0, canvas.width, canvas.height)

  // Dim everything outside the tracked zone.
  ctx.fillStyle = view === 'affiche' ? 'rgba(20, 20, 20, 0.45)' : 'rgba(20, 20, 20, 0.75)'
  ctx.beginPath()
  ctx.rect(0, 0, canvas.width, canvas.height)
  ctx.rect(zone.x * k, zone.y * k, zone.w * k, zone.h * k)
  ctx.fill('evenodd')

  if (view !== 'affiche') {
    ctx.save()
    // Work space -> canvas pixels.
    if (c.isRotated) ctx.setTransform(0, -k, k, 0, 0, H * k)
    else ctx.setTransform(k, 0, 0, k, 0, 0)
    ctx.beginPath()
    ctx.rect(c.left, c.top, c.width, c.height)
    ctx.clip()
    ctx.drawImage(a.luminance, c.left, c.top, c.width, c.height)

    if (view === 'points') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)'
      ctx.fillRect(c.left, c.top, c.width, c.height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(a.dots, c.left, c.top, c.width, c.height)
    }

    if (view === 'zones') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
      ctx.fillRect(c.left, c.top, c.width, c.height)
      const cw = c.width / GRID_CELLS
      const ch = c.height / GRID_CELLS
      ctx.fillStyle = 'rgba(214, 40, 40, 0.6)'
      r.score.perCell.forEach((count, i) => {
        if (count < EMPTY_CELL) ctx.fillRect(c.left + (i % GRID_CELLS) * cw, c.top + Math.floor(i / GRID_CELLS) * ch, cw, ch)
      })
      ctx.strokeStyle = 'rgba(20, 20, 20, 0.45)'
      ctx.lineWidth = dpr / k
      ctx.beginPath()
      for (let i = 1; i < GRID_CELLS; i++) {
        ctx.moveTo(c.left + i * cw, c.top)
        ctx.lineTo(c.left + i * cw, c.top + c.height)
        ctx.moveTo(c.left, c.top + i * ch)
        ctx.lineTo(c.left + c.width, c.top + i * ch)
      }
      ctx.stroke()
    }
    ctx.restore()
  }

  ctx.strokeStyle = '#ff2d87'
  ctx.lineWidth = 2 * dpr
  ctx.strokeRect(zone.x * k, zone.y * k, zone.w * k, zone.h * k)
}

// Tabs + canvas + legend. `onView` keeps the chosen view across re-renders.
export const createInspector = (
  r: ProcessedTarget,
  view: View,
  opts: {onView?: (v: View) => void; onEnlarge?: () => void} = {},
): HTMLElement => {
  const root = document.createElement('div')
  root.className = 'tc-inspector'
  root.innerHTML = `
    <div class="tc-tabs" role="tablist" aria-label="Vue de l'affiche">
      ${VIEWS.map((v) => `<button type="button" role="tab" data-view="${v.id}">${v.label}</button>`).join('')}
    </div>
    <div class="tc-stage">
      <canvas role="img"></canvas>
      ${opts.onEnlarge ? `<button type="button" class="tc-enlarge">${icon('maximize')}Agrandir</button>` : ''}
    </div>
    <p class="tc-legend"></p>`
  const {W, H} = geometry(r)
  root.style.setProperty('--ratio', String(W / H))
  const canvas = root.querySelector('canvas')!
  const legend = root.querySelector<HTMLElement>('.tc-legend')!
  const assets = loadAssets(r)

  const show = async (v: View) => {
    view = v
    const info = VIEWS.find((x) => x.id === v)!
    for (const tab of root.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      tab.setAttribute('aria-selected', String(tab.dataset.view === v))
    }
    legend.textContent = info.legend
    canvas.setAttribute('aria-label', `${info.label} : ${r.name}`)
    draw(canvas, r, await assets, v)
  }

  root.querySelector('.tc-tabs')!.addEventListener('click', (ev) => {
    const tab = (ev.target as HTMLElement).closest<HTMLButtonElement>('[data-view]')
    if (!tab) return
    void show(tab.dataset.view as View)
    opts.onView?.(view)
  })
  root.querySelector('.tc-enlarge')?.addEventListener('click', () => opts.onEnlarge?.())

  // Redraw at the right resolution whenever the layout changes width.
  let lastWidth = 0
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width)
    if (!width || width === lastWidth) return
    lastWidth = width
    void show(view)
  }).observe(canvas)
  return root
}
