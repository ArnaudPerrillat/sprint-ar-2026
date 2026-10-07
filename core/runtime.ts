// Runtime: turns a validated experience into bricks inside posterRoot, and drives triggers,
// taps and behaviors from the stage events (found / lost / tap / frame).

import * as THREE from 'three'
import type {Experience} from './schema/schema'
import type {Stage, StageEvents} from './stage'
import type {PosterInfo} from './ar/target'
import {fromLocal, toLocal} from './ar/poster-anchor'
import {BrickBase, type BrickEnv, type ViewState} from './bricks/brick'
import {createBrick} from './bricks'
import {Tweens} from './util/tween'
import {Sound} from './util/sound'
import {experienceUrl} from './util/env'
import {report, errorMessage} from './ui/errors'
import type {Behavior, BrickHandle, Ctx, TapHit} from './behaviors'
import {mountSoundButton} from './ui/sound-button'

interface Scheduled {
  remaining: number
  run: () => void
}

interface LoadedBehavior {
  name: string
  impl: Behavior
  errors: number
  disabled: boolean
}

const MAX_UPDATE_ERRORS = 3

export class Runtime {
  readonly tweens = new Tweens()
  readonly sound = new Sound()
  readonly view: ViewState = {tilt: 0, tiltX: 0, tiltY: 0, distance: 1}
  readonly device = {alpha: 0, beta: 0, gamma: 0}
  tracked = false

  private bricks: BrickBase[] = []
  private behaviors: LoadedBehavior[] = []
  private scheduled = new Map<string, Scheduled>()
  private everFound = false
  private shownBeforeLost = new Set<string>()
  private ready = false
  private pendingFound = false
  private elapsed = 0
  private ctx!: Ctx
  private raycaster = new THREE.Raycaster()
  private tapPlane!: THREE.Mesh
  private overlay: HTMLElement
  private listeners = new Set<(tracked: boolean) => void>()

  constructor(
    private readonly stage: Stage,
    readonly experience: Experience,
    readonly poster: PosterInfo,
    // Folder holding behaviors/ ("" = experience/, or examples/<name>/ for the examples).
    private readonly behaviorsBase = '',
  ) {
    this.overlay = document.getElementById('ra-hotspots') ?? document.body
    window.addEventListener('deviceorientation', (e) => {
      this.device.alpha = e.alpha ?? 0
      this.device.beta = e.beta ?? 0
      this.device.gamma = e.gamma ?? 0
    })
  }

  // Stage callbacks. They are safe to call before init() completes.
  readonly events: StageEvents = {
    found: () => (this.ready ? this.onFound() : (this.pendingFound = true)),
    lost: () => (this.ready ? this.onLost() : (this.pendingFound = false)),
    tap: (x, y) => this.ready && this.onTap(x, y),
    frame: (t, dt) => this.ready && this.onFrame(t, dt),
  }

  onTrackingChange(cb: (tracked: boolean) => void): void {
    this.listeners.add(cb)
  }

  async init(): Promise<void> {
    const {posterRoot, camera, renderer, mode} = this.stage
    const env: BrickEnv = {
      ratio: this.poster.ratio,
      tweens: this.tweens,
      sound: this.sound,
      camera,
      renderer,
      overlay: this.overlay,
      mode,
    }

    // Invisible plane used to turn taps into poster coordinates.
    this.tapPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, this.poster.ratio),
      new THREE.MeshBasicMaterial({visible: false}),
    )
    this.tapPlane.name = 'tap-plane'
    posterRoot.add(this.tapPlane)

    for (const config of this.experience.bricks) {
      try {
        const brick = createBrick(config, env)
        this.bricks.push(brick)
        posterRoot.add(brick.holder)
      } catch (err) {
        report('error', `La brique « ${config.id} » n'a pas pu être créée : ${errorMessage(err)}`)
      }
    }

    await Promise.all(this.bricks.map(async (brick) => {
      try {
        await brick.load()
      } catch (err) {
        report('error', `La brique « ${brick.id} » : ${errorMessage(err)}`)
      }
    }))

    // A video with sound needs a way to turn it on.
    if (this.experience.bricks.some((b) => b.type === 'video' && b.sound)) mountSoundButton(this.sound)

    this.ctx = this.createCtx()
    await this.loadBehaviors()

    this.ready = true
    if (this.pendingFound) this.onFound()
  }

  // -------------------------------------------------------------------------
  // Tracking

  private onFound(): void {
    this.tracked = true
    this.listeners.forEach((cb) => cb(true))
    const replay = !this.everFound || this.experience.replayOnFound
    this.everFound = true
    if (replay) {
      this.scheduled.clear()
      this.bricks.forEach((b) => b.reset())
      for (const brick of this.bricks) {
        const {trigger, delay} = brick.config
        if (trigger.type === 'found') this.schedule(brick, delay)
        else if (trigger.type === 'delay') this.schedule(brick, trigger.ms + delay)
      }
    } else {
      for (const brick of this.bricks) if (this.shownBeforeLost.has(brick.id)) brick.show()
    }
    this.callBehaviors('onFound')
  }

  private onLost(): void {
    this.tracked = false
    this.listeners.forEach((cb) => cb(false))
    if (this.experience.onLost === 'hide') {
      this.shownBeforeLost = new Set(this.bricks.filter((b) => b.shown).map((b) => b.id))
      this.scheduled.clear()
      this.bricks.forEach((b) => b.hide(true))
    }
    this.callBehaviors('onLost')
  }

  private schedule(brick: BrickBase, ms: number): void {
    if (this.scheduled.has(brick.id)) return
    if (ms <= 0) {
      brick.show()
      return
    }
    this.scheduled.set(brick.id, {remaining: ms, run: () => brick.show()})
  }

  // Content keeps living while frozen after a loss.
  private get active(): boolean {
    return this.tracked || (this.everFound && this.experience.onLost === 'freeze')
  }

  // -------------------------------------------------------------------------
  // Frame loop

  private onFrame(timeMs: number, dtMs: number): void {
    const dt = Math.min(dtMs, 100)
    this.elapsed += dt
    this.tweens.update(dt)
    this.updateView()

    if (this.active) {
      for (const [id, s] of this.scheduled) {
        s.remaining -= dt
        if (s.remaining <= 0) {
          this.scheduled.delete(id)
          s.run()
        }
      }
    }

    if (this.tracked) {
      for (const brick of this.bricks) {
        const {trigger} = brick.config
        let condition: boolean | null = null
        if (trigger.type === 'tilt') {
          condition = this.view.tilt >= trigger.min && this.view.tilt <= trigger.max
        } else if (trigger.type === 'distance') {
          condition = (trigger.near === undefined || this.view.distance <= trigger.near) &&
            (trigger.far === undefined || this.view.distance >= trigger.far)
        }
        if (condition === null) continue
        if (condition && !brick.shown) this.schedule(brick, brick.config.delay)
        else if (!condition) {
          this.scheduled.delete(brick.id)
          if (brick.shown) brick.hide()
        }
      }
    }

    for (const brick of this.bricks) {
      if (!brick.holder.visible) continue
      try {
        brick.update(this.elapsed, dt, this.view)
      } catch (err) {
        report('error', `La brique « ${brick.id} » : ${errorMessage(err)}`)
      }
    }

    if (this.active) this.callBehaviors('onUpdate', this.elapsed / 1000, dt / 1000)
    void timeMs
  }

  private camWorld = new THREE.Vector3()
  private camLocal = new THREE.Vector3()

  private updateView(): void {
    const {camera, posterRoot} = this.stage
    camera.getWorldPosition(this.camWorld)
    posterRoot.updateWorldMatrix(true, false)
    this.camLocal.copy(this.camWorld)
    posterRoot.worldToLocal(this.camLocal)
    const v = this.camLocal
    const len = v.length() || 1
    this.view.distance = len
    this.view.tilt = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.z / len, -1, 1)))
    this.view.tiltX = THREE.MathUtils.radToDeg(Math.atan2(v.x, v.z))
    this.view.tiltY = THREE.MathUtils.radToDeg(Math.atan2(v.y, v.z))
  }

  // -------------------------------------------------------------------------
  // Taps

  private onTap(clientX: number, clientY: number): void {
    if (!this.active) return
    const rect = this.stage.canvas.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.stage.camera)

    let hitBrick: BrickBase | null = null
    let best = Infinity
    for (const brick of this.bricks) {
      if (!brick.holder.visible) continue
      const hits = this.raycaster.intersectObjects(brick.hitObjects(), true)
      if (hits.length && hits[0].distance < best) {
        best = hits[0].distance
        hitBrick = brick
      }
    }
    const planeHit = this.raycaster.intersectObject(this.tapPlane, false)[0]
    let x: number | null = null
    let y: number | null = null
    if (planeHit) {
      const local = this.stage.posterRoot.worldToLocal(planeHit.point.clone())
      const p = fromLocal(this.poster.ratio, local)
      x = p.x
      y = p.y
    }
    this.handleTap({brick: hitBrick?.id ?? null, x, y})
  }

  // Also used by the preview's "simulate tap" button.
  handleTap(hit: TapHit): void {
    for (const brick of this.bricks) {
      const {trigger, delay} = brick.config
      if (trigger.type !== 'tap') continue
      const target = trigger.on === 'self' ? brick.id : trigger.on
      if (target && target !== hit.brick) continue
      if (brick.shown) {
        if (trigger.toggle) brick.hide()
      } else {
        this.schedule(brick, delay)
      }
    }
    this.callBehaviors('onTap', Object.freeze({...hit}))
  }

  // -------------------------------------------------------------------------
  // Behaviors

  private handle(brick: BrickBase): BrickHandle {
    const config = Object.freeze(structuredClone(brick.config)) as Readonly<Record<string, unknown>>
    return Object.freeze({
      id: brick.id,
      type: brick.config.type,
      object3d: brick.content,
      get shown() {
        return brick.shown
      },
      config,
      show: () => brick.show(),
      hide: () => brick.hide(),
    })
  }

  private createCtx(): Ctx {
    const handles = new Map(this.bricks.map((b) => [b.id, this.handle(b)]))
    const runtime = this
    const ratio = this.poster.ratio
    return Object.freeze({
      THREE,
      poster: this.stage.posterRoot,
      mode: this.stage.mode,
      view: this.view,
      device: this.device,
      get tracked() {
        return runtime.tracked
      },
      bricks: Object.freeze({
        get: (id: string) => handles.get(id),
        list: () => [...handles.values()],
        show: (id: string) => handles.get(id)?.show(),
        hide: (id: string) => handles.get(id)?.hide(),
      }),
      toLocal: (x: number, y: number, z = 0) => toLocal(ratio, x, y, z),
      fromLocal: (v: THREE.Vector3) => fromLocal(ratio, v),
      tween: (options) => this.tweens.add(options),
      sound: Object.freeze({
        get enabled() {
          return runtime.sound.enabled
        },
        play: (path: string, options?: {loop?: boolean; volume?: number}) => runtime.sound.play(path, options),
      }),
      state: {},
      log: (message: string) => report('warning', `Behavior : ${message}`),
    } satisfies Ctx)
  }

  private async loadBehaviors(): Promise<void> {
    for (const name of this.experience.behaviors) {
      const file = `${this.behaviorsBase}behaviors/${name}.js`
      try {
        const head = await fetch(experienceUrl(file), {method: 'HEAD', cache: 'no-cache'}).catch(() => null)
        const type = head?.headers.get('content-type') ?? ''
        if (!head?.ok || type.includes('text/html')) {
          report('error', `Behavior « ${name} » : le fichier ${this.behaviorsBase ? "" : "experience/"}${file} est introuvable.`)
          continue
        }
        const mod = await import(/* @vite-ignore */ experienceUrl(file))
        const impl = mod.default as Behavior | undefined
        if (!impl || typeof impl !== 'object') {
          report('error', `Behavior « ${name} » : le fichier ${file} doit contenir "export default { ... }".`)
          continue
        }
        const known = ['onFound', 'onLost', 'onTap', 'onUpdate']
        for (const key of Object.keys(impl)) {
          if (!known.includes(key)) {
            report('warning', `Behavior « ${name} » : "${key}" n'est pas reconnu (attendus : ${known.join(', ')}).`)
          }
        }
        this.behaviors.push({name, impl, errors: 0, disabled: false})
      } catch (err) {
        report('error', `Behavior « ${name} » : impossible de charger ${file} — ${errorMessage(err)}`)
      }
    }
  }

  private callBehaviors(hook: keyof Behavior, ...args: unknown[]): void {
    for (const b of this.behaviors) {
      if (b.disabled) continue
      const fn = b.impl[hook] as ((ctx: Ctx, ...rest: unknown[]) => void) | undefined
      if (typeof fn !== 'function') continue
      try {
        fn.call(b.impl, this.ctx, ...args)
      } catch (err) {
        b.errors++
        report('error', `Behavior « ${b.name} » (${hook}) : ${errorMessage(err)}`)
        if (hook === 'onUpdate' && b.errors >= MAX_UPDATE_ERRORS) {
          b.disabled = true
          report('warning', `Behavior « ${b.name} » désactivé après ${MAX_UPDATE_ERRORS} erreurs.`)
        }
      }
    }
  }
}
