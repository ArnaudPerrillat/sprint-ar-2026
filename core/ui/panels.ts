// HTML panels for behaviors (ctx.ui): screen UI a behavior builds itself (a music player, a
// score...). The core owns the container: panels sit above the AR view, follow the theme, never
// let a tap through to the AR scene, and are hidden while no poster is in view.

export type PanelPosition = 'bottom' | 'top' | 'free'

export interface PanelOptions {
  position?: PanelPosition
  // true: stays on screen even when the poster is lost (e.g. a player that keeps playing).
  keep?: boolean
}

interface Panel {
  el: HTMLElement
  keep: boolean
}

const ID_RE = /^[a-z0-9][a-z0-9-]*$/

// Wraps student CSS so it only reaches the panels. @keyframes / @font-face cannot be nested inside
// a style rule: they are kept at the top level (they only define names, they style nothing).
export const scopeCss = (css: string, scope: string): string => {
  const hoisted: string[] = []
  let rest = ''
  let i = 0
  while (i < css.length) {
    const at = css.slice(i).search(/@(-webkit-)?(keyframes|font-face)\b/)
    if (at < 0) {
      rest += css.slice(i)
      break
    }
    const start = i + at
    const open = css.indexOf('{', start)
    if (open < 0) {
      rest += css.slice(i)
      break
    }
    let depth = 0
    let end = open
    for (; end < css.length; end++) {
      if (css[end] === '{') depth++
      else if (css[end] === '}' && --depth === 0) break
    }
    rest += css.slice(i, start)
    hoisted.push(css.slice(start, end + 1))
    i = end + 1
  }
  return `${hoisted.join('\n')}\n${scope} {\n${rest}\n}`
}

export class Panels {
  private root = document.createElement('div')
  private panels = new Map<string, Panel>()
  private sheet = document.createElement('style')
  private rules: string[] = []
  private active = false

  constructor(overlay: HTMLElement) {
    this.root.className = 'ra-panels'
    overlay.appendChild(this.root)
    this.sheet.dataset.raPanels = ''
    document.head.appendChild(this.sheet)
  }

  // Same id = same element: calling it again in every onFound never creates duplicates.
  panel(id: string, options: PanelOptions = {}): HTMLElement {
    if (typeof id !== 'string' || !ID_RE.test(id)) {
      throw new Error(`ctx.ui.panel("${id}") : l'id doit être court, en minuscules, sans espace ni accent (ex. "lecteur").`)
    }
    const existing = this.panels.get(id)
    if (existing) return existing.el
    const position = options.position ?? 'bottom'
    if (!['bottom', 'top', 'free'].includes(position)) {
      throw new Error(`ctx.ui.panel("${id}") : position "${position}" inconnue (attendues : bottom, top, free).`)
    }
    const el = document.createElement('div')
    el.className = `ra-panel is-${position} ${id}`
    el.dataset.panel = id
    // The panel is drawn above the canvas, so a tap on it never reaches the AR scene; stopping
    // propagation also keeps it away from any window-level listener.
    for (const type of ['click', 'pointerdown', 'pointerup', 'touchstart'] as const) {
      el.addEventListener(type, (e) => e.stopPropagation(), {passive: true})
    }
    const panel = {el, keep: options.keep === true}
    this.panels.set(id, panel)
    this.root.appendChild(el)
    this.apply(panel)
    return el
  }

  get(id: string): HTMLElement | undefined {
    return this.panels.get(id)?.el
  }

  remove(id: string): void {
    this.panels.get(id)?.el.remove()
    this.panels.delete(id)
  }

  // CSS that only applies inside the panels. Theme variables (--ra-color, --ra-text, --ra-font,
  // --ra-bg) are available.
  style(css: string): void {
    if (typeof css !== 'string' || !css.trim()) return
    // Same CSS added again in every onFound: kept once.
    if (this.rules.includes(css)) return
    this.rules.push(css)
    this.sheet.textContent = this.rules.map((r) => scopeCss(r, '.ra-panels')).join('\n')
  }

  // Called by the runtime: true while a poster is in view (or frozen, with "onLost": "freeze").
  setActive(active: boolean): void {
    if (active === this.active) return
    this.active = active
    this.panels.forEach((p) => this.apply(p))
  }

  private apply(panel: Panel): void {
    panel.el.hidden = !(this.active || panel.keep)
  }
}
