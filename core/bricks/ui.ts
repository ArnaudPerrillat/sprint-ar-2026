// "ui" brick: HTML hotspots pinned on the poster (3D -> screen projection every frame), a call to
// action button, and the sound button. Styled with the theme CSS variables.

import * as THREE from 'three'
import type {UiBrick} from '../schema/schema'
import {BrickBase} from './brick'
import {toLocal} from '../ar/poster-anchor'
import {mountSoundButton} from '../ui/sound-button'

const openLink = (url: string) => window.open(url, '_blank', 'noopener')

export class UiBrickImpl extends BrickBase<UiBrick> {
  private layer = document.createElement('div')
  private cta: HTMLButtonElement | null = null
  private spots: {el: HTMLButtonElement; local: THREE.Vector3}[] = []
  private sheet: HTMLElement | null = null
  private tmp = new THREE.Vector3()

  async load(): Promise<void> {
    const {hotspots, cta, soundButton} = this.config
    this.layer.className = 'ra-ui'
    this.layer.style.opacity = '0'
    this.layer.hidden = true
    this.env.overlay.appendChild(this.layer)

    hotspots.forEach((spot, index) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'ra-hotspot'
      el.textContent = spot.label
      el.setAttribute('aria-label', spot.text ? spot.label : `Lien ${index + 1}`)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (spot.text) this.openSheet(spot.label, spot.text, spot.link)
        else if (spot.link) openLink(spot.link)
      })
      this.layer.appendChild(el)
      this.spots.push({el, local: toLocal(this.env.ratio, spot.x, spot.y, spot.z)})
    })

    if (cta) {
      this.cta = document.createElement('button')
      this.cta.type = 'button'
      this.cta.className = 'ra-cta'
      this.cta.textContent = cta.label
      this.cta.addEventListener('click', (e) => {
        e.stopPropagation()
        openLink(cta.url)
      })
      this.layer.appendChild(this.cta)
    }

    if (soundButton) mountSoundButton(this.env.sound)
  }

  private openSheet(title: string, text: string, link?: string): void {
    this.sheet?.remove()
    const sheet = document.createElement('div')
    sheet.className = 'ra-sheet'
    const h = document.createElement('strong')
    h.textContent = title
    const p = document.createElement('p')
    p.textContent = text
    sheet.append(h, p)
    if (link) {
      const a = document.createElement('button')
      a.type = 'button'
      a.className = 'ra-sheet-link'
      a.textContent = 'Ouvrir le lien'
      a.addEventListener('click', () => openLink(link))
      sheet.append(a)
    }
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'ra-sheet-close'
    close.setAttribute('aria-label', 'Fermer')
    close.textContent = '×'
    close.addEventListener('click', () => {
      sheet.remove()
      this.sheet = null
    })
    sheet.append(close)
    sheet.addEventListener('click', (e) => e.stopPropagation())
    document.body.appendChild(sheet)
    this.sheet = sheet
  }

  protected onShow(): void {
    this.layer.hidden = false
  }

  protected onHidden(): void {
    this.layer.hidden = true
    this.layer.style.opacity = '0'
    this.sheet?.remove()
    this.sheet = null
  }

  protected onFade(factor: number): void {
    this.layer.style.opacity = String(factor)
  }

  hitObjects(): THREE.Object3D[] {
    return []
  }

  update(): void {
    if (!this.spots.length) return
    const canvas = this.env.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    const root = this.holder.parent
    if (!root) return
    for (const {el, local} of this.spots) {
      this.tmp.copy(local)
      root.localToWorld(this.tmp)
      this.tmp.project(this.env.camera)
      const visible = this.tmp.z > -1 && this.tmp.z < 1 && Math.abs(this.tmp.x) < 1.1 && Math.abs(this.tmp.y) < 1.1
      el.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) continue
      const x = rect.left + ((this.tmp.x + 1) / 2) * rect.width
      const y = rect.top + ((1 - this.tmp.y) / 2) * rect.height
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
    }
  }
}
