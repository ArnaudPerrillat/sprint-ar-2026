// "collection" brick: a grid fixed on screen, one cell per poster. A cell fills (with a pop) when
// its poster is found; the state is remembered on the phone. When every cell is filled, the
// "reveal" panel opens. Not attached to a poster: its trigger is ignored, it is always visible.

import * as THREE from 'three'
import type {CollectionBrick} from '../schema/schema'
import {BrickBase} from './brick'
import {experienceUrl} from '../util/env'

export class CollectionBrickImpl extends BrickBase<CollectionBrick> {
  private root = document.createElement('section')
  private cells = new Map<string, HTMLElement>()
  private counter = document.createElement('span')
  private sheet: HTMLElement | null = null

  async load(): Promise<void> {
    const {columns, pieces, position, size, hint} = this.config
    const {collection} = this.env
    this.root.className = `ra-collection is-${position}`
    this.root.style.setProperty('--ra-col-size', String(size))
    // Keep the grid under ~35% of the screen height (cells have the poster's proportions).
    const rows = Math.ceil(pieces.length / columns)
    this.root.style.setProperty('--ra-col-maxw', `calc(35vh * ${(columns / (rows * Math.SQRT2)).toFixed(3)})`)
    this.root.setAttribute('aria-label', 'Collection d\'affiches')
    this.root.hidden = true

    const head = document.createElement('header')
    const label = document.createElement('span')
    label.className = 'ra-collection-hint'
    label.textContent = hint ?? 'Collection'
    this.counter.className = 'ra-collection-count'
    const reset = document.createElement('button')
    reset.type = 'button'
    reset.className = 'ra-collection-reset'
    reset.title = 'Recommencer la collection'
    reset.setAttribute('aria-label', 'Recommencer la collection')
    reset.textContent = '↺'
    reset.addEventListener('click', (e) => {
      e.stopPropagation()
      if (confirm('Recommencer la collection depuis zéro ?')) collection.reset()
    })
    head.append(label, this.counter, reset)

    const grid = document.createElement('div')
    grid.className = 'ra-collection-grid'
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`
    pieces.forEach((piece, index) => {
      const cell = document.createElement('div')
      cell.className = 'ra-collection-cell'
      cell.dataset.number = String(index + 1)
      const url = piece.src ? experienceUrl(piece.src) : this.env.posterImages.get(piece.target) ?? null
      if (url) cell.style.backgroundImage = `url("${url}")`
      grid.appendChild(cell)
      this.cells.set(piece.target, cell)
    })
    grid.addEventListener('click', (e) => {
      e.stopPropagation()
      if (collection.complete && this.config.reveal) this.openReveal()
    })

    this.root.append(head, grid)
    document.body.appendChild(this.root)

    this.render(null)
    collection.onChange((_c, added) => this.render(added))
  }

  private render(added: string | null): void {
    const {collection} = this.env
    for (const [id, cell] of this.cells) {
      const has = collection.has(id)
      cell.classList.toggle('is-found', has)
      if (has && id === added) {
        cell.classList.remove('is-new')
        void cell.offsetWidth
        cell.classList.add('is-new')
      }
    }
    this.counter.textContent = `${collection.count} / ${collection.total}`
    this.root.classList.toggle('is-complete', collection.complete)
    if (added && collection.complete && this.config.reveal) {
      // Let the last piece land before opening the reveal.
      setTimeout(() => this.openReveal(), 900)
    }
  }

  private openReveal(): void {
    const reveal = this.config.reveal
    if (!reveal) return
    this.sheet?.remove()
    const sheet = document.createElement('div')
    sheet.className = 'ra-modal ra-reveal'
    const card = document.createElement('div')
    card.className = 'ra-modal-card'
    const title = document.createElement('h2')
    title.textContent = reveal.title
    card.appendChild(title)
    if (reveal.image) {
      const img = new Image()
      img.src = experienceUrl(reveal.image)
      img.alt = ''
      card.appendChild(img)
    }
    if (reveal.text) {
      const p = document.createElement('p')
      p.textContent = reveal.text
      card.appendChild(p)
    }
    if (reveal.link) {
      const link = document.createElement('button')
      link.type = 'button'
      link.className = 'ra-sheet-link'
      link.textContent = 'En savoir plus'
      link.addEventListener('click', () => window.open(reveal.link, '_blank', 'noopener'))
      card.appendChild(link)
    }
    const close = document.createElement('button')
    close.type = 'button'
    close.textContent = 'Fermer'
    close.addEventListener('click', () => sheet.remove())
    card.appendChild(close)
    sheet.appendChild(card)
    sheet.addEventListener('click', (e) => {
      e.stopPropagation()
      if (e.target === sheet) sheet.remove()
    })
    document.body.appendChild(sheet)
    this.sheet = sheet
  }

  protected onShow(): void {
    this.root.hidden = false
  }

  protected onHidden(): void {
    this.root.hidden = true
  }

  protected onFade(factor: number): void {
    this.root.style.opacity = String(factor)
  }

  hitObjects(): THREE.Object3D[] {
    return []
  }
}
