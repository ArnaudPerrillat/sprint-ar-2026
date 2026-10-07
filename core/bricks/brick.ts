// Common brick machinery: placement in poster space, appear/disappear animations, fading.

import * as THREE from 'three'
import type {Brick} from '../schema/schema'
import {toLocal} from '../ar/poster-anchor'
import type {Tweens, TweenHandle} from '../util/tween'
import type {Sound} from '../util/sound'

export interface ViewState {
  // Angle between the poster normal and the direction poster -> camera, in degrees (0 = face on).
  tilt: number
  // Signed horizontal / vertical viewing angles in degrees (right / up are positive).
  tiltX: number
  tiltY: number
  // Camera distance to the poster centre, in poster widths.
  distance: number
}

export interface BrickEnv {
  ratio: number
  tweens: Tweens
  sound: Sound
  camera: THREE.Camera
  renderer: THREE.WebGLRenderer
  overlay: HTMLElement
  mode: 'ar' | 'preview'
}

type FadeMaterial = THREE.Material & {
  opacity: number
  uniforms?: Record<string, THREE.IUniform>
  userData: {baseOpacity?: number; baseTransparent?: boolean}
}

export abstract class BrickBase<T extends Brick = Brick> {
  // holder: placement + appear animation. content: what the brick draws.
  readonly holder = new THREE.Group()
  readonly content = new THREE.Group()
  shown = false
  private fade = 1
  private anim: TweenHandle | null = null

  constructor(readonly config: T, protected readonly env: BrickEnv) {
    this.holder.name = `brick:${config.id}`
    this.holder.add(this.content)
    this.holder.visible = false
    const p = toLocal(env.ratio, config.x, config.y, config.z)
    this.holder.position.copy(p)
    const r = config.rotation
    if (typeof r === 'number') {
      this.content.rotation.set(0, 0, THREE.MathUtils.degToRad(-r))
    } else {
      this.content.rotation.set(
        THREE.MathUtils.degToRad(r.x),
        THREE.MathUtils.degToRad(r.y),
        THREE.MathUtils.degToRad(-r.z),
      )
    }
  }

  get id(): string {
    return this.config.id
  }

  abstract load(): Promise<void>

  // Hooks for subclasses.
  protected onShow(): void {}
  protected onHide(): void {}
  protected onHidden(): void {}
  update(_timeMs: number, _dtMs: number, _view: ViewState): void {}

  // Objects used for tap raycasting.
  hitObjects(): THREE.Object3D[] {
    return [this.content]
  }

  show(): void {
    if (this.shown) return
    this.shown = true
    this.anim?.cancel()
    this.holder.visible = true
    this.onShow()
    const {appear, duration} = this.config
    const holder = this.holder
    const base = toLocal(this.env.ratio, this.config.x, this.config.y, this.config.z)
    if (appear === 'none' || duration === 0) {
      holder.scale.setScalar(1)
      holder.position.copy(base)
      this.setFade(1)
      return
    }
    this.anim = this.env.tweens.add({
      from: 0,
      to: 1,
      duration,
      easing: appear === 'pop' ? 'backOut' : 'easeOut',
      onUpdate: (k) => this.applyAppear(k, base),
    })
  }

  hide(fast = false): void {
    if (!this.shown) return
    this.shown = false
    this.anim?.cancel()
    this.onHide()
    const base = toLocal(this.env.ratio, this.config.x, this.config.y, this.config.z)
    const duration = fast ? 200 : Math.min(this.config.duration, 400)
    if (this.config.appear === 'none' || duration === 0) {
      this.holder.visible = false
      this.onHidden()
      return
    }
    const from = this.fade
    this.anim = this.env.tweens.add({
      from,
      to: 0,
      duration,
      easing: 'easeIn',
      onUpdate: (k) => this.applyAppear(Math.max(0, k), base, true),
      onComplete: () => {
        this.holder.visible = false
        this.onHidden()
      },
    })
  }

  // Resets to the hidden state without animation (used before replaying an experience).
  reset(): void {
    this.anim?.cancel()
    this.shown = false
    this.holder.visible = false
    this.onHidden()
  }

  private applyAppear(k: number, base: THREE.Vector3, hiding = false): void {
    const {appear} = this.config
    const holder = this.holder
    holder.position.copy(base)
    holder.scale.setScalar(1)
    if (appear === 'pop') {
      holder.scale.setScalar(Math.max(0.0001, k))
      this.setFade(Math.min(1, k * 2))
    } else if (appear === 'rise') {
      holder.position.y = base.y - (1 - k) * 0.08
      this.setFade(Math.min(1, k))
    } else {
      this.setFade(Math.min(1, Math.max(0, k)))
    }
    if (hiding && appear === 'pop') holder.scale.setScalar(Math.max(0.0001, 0.6 + 0.4 * k))
  }

  // Multiplies every material's opacity by `f` (and by the brick's own opacity).
  setFade(f: number): void {
    this.fade = f
    const factor = f * this.config.opacity
    this.content.traverse((obj) => {
      const mats = (obj as THREE.Mesh).material
      if (!mats) return
      for (const m of Array.isArray(mats) ? mats : [mats]) this.fadeMaterial(m as FadeMaterial, factor)
    })
    this.onFade(factor)
  }

  protected onFade(_factor: number): void {}

  private fadeMaterial(m: FadeMaterial, factor: number): void {
    if (m.userData.baseOpacity === undefined) {
      m.userData.baseOpacity = m.opacity ?? 1
      m.userData.baseTransparent = m.transparent
    }
    const value = m.userData.baseOpacity * factor
    if (m.uniforms?.uOpacity) {
      m.uniforms.uOpacity.value = value
    } else {
      m.opacity = value
    }
    // Opaque materials (glTF models) only become transparent while fading, to avoid sorting issues.
    const transparent = !!m.userData.baseTransparent || value < 0.999
    if (m.transparent !== transparent) {
      m.transparent = transparent
      m.needsUpdate = true
    }
  }

  dispose(): void {
    this.anim?.cancel()
    this.content.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = mesh.material
      if (mats) for (const m of Array.isArray(mats) ? mats : [mats]) m.dispose()
    })
  }
}

// Texture helper with a readable error.
const textureLoader = new THREE.TextureLoader()

export const loadTexture = (url: string, label: string): Promise<THREE.Texture> =>
  new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        resolve(tex)
      },
      undefined,
      () => reject(new Error(`impossible de charger « ${label} » (fichier absent ou format non supporté)`)),
    )
  })
