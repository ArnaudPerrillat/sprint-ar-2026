// Runtime: turns a validated experience into bricks anchored on the posters, and drives triggers,
// taps, the collection and behaviors from the stage events (found / lost / tap / frame).
//
// Each brick lives on one poster (its "target", default: the first poster), or on "*" = whichever
// poster is being looked at (it moves to the poster found most recently).

import * as THREE from 'three'
import {brickTarget, targetIds, type Experience} from './schema/schema'
import type {Stage, StageEvents} from './stage'
import type {PosterTarget} from './ar/target'
import {fromLocal, toLocal} from './ar/poster-anchor'
import {BrickBase, type BrickEnv, type ViewState} from './bricks/brick'
import {createBrick} from './bricks'
import {Tweens} from './util/tween'
import {Sound} from './util/sound'
import {experienceUrl} from './util/env'
import {report, errorMessage} from './ui/errors'
import type {Behavior, BrickHandle, Ctx, TapHit} from './behaviors'
import {mountSoundButton} from './ui/sound-button'
import {Collection} from './collection'

interface Scheduled {
  brick: BrickBase
  remaining: number
}

interface LoadedBehavior {
  name: string
  impl: Behavior
  errors: number
  disabled: boolean
}

interface Poster {
  root: THREE.Group
  ratio: number
  tapPlane: THREE.Mesh
}

const MAX_UPDATE_ERRORS = 3

export class Runtime {
  readonly tweens = new Tweens()
  readonly sound = new Sound()
  readonly view: ViewState = {tilt: 0, tiltX: 0, tiltY: 0, distance: 1}
  readonly device = {alpha: 0, beta: 0, gamma: 0}
  readonly collection: Collection
  readonly ids: string[]
  // Posters currently tracked, and the one found most recently (null when none).
  readonly tracked = new Set<string>()
  current: string | null = null

  private posters = new Map<string, Poster>()
  private bricks: BrickBase[] = []
  private behaviors: LoadedBehavior[] = []
  private scheduled = new Map<string, Scheduled>()
  private everFound = new Set<string>()
  private shownBeforeLost = new Set<string>()
  private ready = false
  private pending: {kind: 'found' | 'lost'; id: string}[] = []
  private elapsed = 0
  private ctx!: Ctx
  private raycaster = new THREE.Raycaster()
  private overlay: HTMLElement
  private listeners = new Set<(tracked: boolean) => void>()

  constructor(
    private readonly stage: Stage,
    readonly experience: Experience,
    readonly targets: PosterTarget[],
    // Folder holding behaviors/ ("" = experience/, or examples/<name>/ for the examples).
    private readonly behaviorsBase = '',
  ) {
    this.ids = targetIds(experience)
    this.collection = new Collection(this.ids, `${behaviorsBase}${experience.title}`)
    // After a reset, the poster(s) in view count again straight away.
    this.collection.onChange((_c, added) => {
      if (added === null) this.tracked.forEach((id) => this.collection.add(id))
    })
    this.overlay = document.getElementById('ra-hotspots') ?? document.body
    window.addEventListener('deviceorientation', (e) => {
      this.device.alpha = e.alpha ?? 0
      this.device.beta = e.beta ?? 0
      this.device.gamma = e.gamma ?? 0
    })
  }

  // Stage callbacks. They are safe to call before init() completes.
  readonly events: StageEvents = {
    found: (id) => (this.ready ? this.onFound(id) : this.pending.push({kind: 'found', id})),
    lost: (id) => (this.ready ? this.onLost(id) : this.pending.push({kind: 'lost', id})),
    tap: (x, y) => this.ready && this.onTap(x, y),
    frame: (t, dt) => this.ready && this.onFrame(t, dt),
  }

  onTrackingChange(cb: (tracked: boolean) => void): void {
    this.listeners.add(cb)
  }

  private notify(): void {
    this.listeners.forEach((cb) => cb(this.tracked.size > 0))
  }

  async init(): Promise<void> {
    const {posterRoots, camera, renderer, mode} = this.stage
    const posterImages = new Map(this.targets.map((t) => [t.id, t.poster.imageUrl]))
    const env: BrickEnv = {
      tweens: this.tweens,
      sound: this.sound,
      camera,
      renderer,
      overlay: this.overlay,
      mode,
      collection: this.collection,
      posterImages,
    }

    for (const target of this.targets) {
      const root = posterRoots.get(target.id)
      if (!root) continue
      // Invisible plane used to turn taps into poster coordinates.
      const tapPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, target.poster.ratio),
        new THREE.MeshBasicMaterial({visible: false}),
      )
      tapPlane.name = 'tap-plane'
      root.add(tapPlane)
      this.posters.set(target.id, {root, ratio: target.poster.ratio, tapPlane})
    }

    for (const config of this.experience.bricks) {
      try {
        const brick = createBrick(config, env)
        const home = config.target === '*' ? this.ids[0] : brickTarget(config, this.ids)
        const poster = this.posters.get(home)
        if (poster) brick.attach(home, poster.root, poster.ratio)
        this.bricks.push(brick)
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
    // The collection grid is screen UI: always visible.
    for (const brick of this.bricks) if (brick.config.type === 'collection') brick.show()

    this.ctx = this.createCtx()
    await this.loadBehaviors()

    this.ready = true
    for (const event of this.pending) event.kind === 'found' ? this.onFound(event.id) : this.onLost(event.id)
    this.pending = []
  }

  // -------------------------------------------------------------------------
  // Tracking

  private isFloating(brick: BrickBase): boolean {
    return brick.config.target === '*'
  }

  private isScreenUi(brick: BrickBase): boolean {
    return brick.config.type === 'collection'
  }

  // Starts (or restores) a brick on its poster after a detection.
  private startBrick(brick: BrickBase, replay: boolean): void {
    if (replay) {
      this.scheduled.delete(brick.id)
      brick.reset()
      const {trigger, delay} = brick.config
      if (trigger.type === 'found') this.schedule(brick, delay)
      else if (trigger.type === 'delay') this.schedule(brick, trigger.ms + delay)
    } else if (this.shownBeforeLost.has(brick.id)) {
      brick.show()
    }
  }

  private moveFloating(brick: BrickBase, id: string): void {
    const poster = this.posters.get(id)
    if (!poster) return
    this.scheduled.delete(brick.id)
    brick.reset()
    brick.attach(id, poster.root, poster.ratio)
    this.startBrick(brick, true)
  }

  private onFound(id: string): void {
    const replay = !this.everFound.has(id) || this.experience.replayOnFound
    this.tracked.add(id)
    this.current = id
    this.everFound.add(id)
    this.collection.add(id)
    this.notify()
    for (const brick of this.bricks) {
      if (this.isScreenUi(brick)) continue
      if (this.isFloating(brick)) {
        if (brick.posterId !== id) this.moveFloating(brick, id)
        else this.startBrick(brick, replay)
      } else if (brick.posterId === id) {
        this.startBrick(brick, replay)
      }
    }
    this.callBehaviors('onFound', id)
  }

  private onLost(id: string): void {
    if (!this.tracked.has(id)) return
    this.tracked.delete(id)
    if (this.current === id) this.current = [...this.tracked].pop() ?? null
    this.notify()
    for (const brick of this.bricks) {
      if (this.isScreenUi(brick) || brick.posterId !== id) continue
      // Content following "*" jumps to another poster that is still in view.
      if (this.isFloating(brick) && this.current) {
        this.moveFloating(brick, this.current)
        continue
      }
      if (this.experience.onLost === 'hide') {
        if (brick.shown) this.shownBeforeLost.add(brick.id)
        else this.shownBeforeLost.delete(brick.id)
        this.scheduled.delete(brick.id)
        brick.hide(true)
      }
    }
    this.callBehaviors('onLost', id)
  }

  private schedule(brick: BrickBase, ms: number): void {
    if (this.scheduled.has(brick.id)) return
    if (ms <= 0) {
      brick.show()
      return
    }
    this.scheduled.set(brick.id, {brick, remaining: ms})
  }

  // A poster's content keeps living while frozen after a loss.
  private posterActive(id: string | null): boolean {
    if (!id) return false
    return this.tracked.has(id) || (this.everFound.has(id) && this.experience.onLost === 'freeze')
  }

  private get anyActive(): boolean {
    return this.ids.some((id) => this.posterActive(id))
  }

  // -------------------------------------------------------------------------
  // Frame loop

  private onFrame(_timeMs: number, dtMs: number): void {
    const dt = Math.min(dtMs, 100)
    this.elapsed += dt
    this.tweens.update(dt)
    this.updateView()

    for (const [id, s] of this.scheduled) {
      if (!this.posterActive(s.brick.posterId)) continue
      s.remaining -= dt
      if (s.remaining <= 0) {
        this.scheduled.delete(id)
        s.brick.show()
      }
    }

    for (const brick of this.bricks) {
      if (this.isScreenUi(brick) || !brick.posterId || !this.tracked.has(brick.posterId)) continue
      const {trigger} = brick.config
      let condition: boolean | null = null
      if (trigger.type === 'tilt') {
        condition = this.view.tilt >= trigger.min && this.view.tilt <= trigger.max
      } else if (trigger.type === 'distance') {
        condition = (trigger.near === undefined || this.view.distance <= trigger.near) &&
          (trigger.far === undefined || this.view.distance >= trigger.far)
      } else if (trigger.type === 'collected') {
        const needed = trigger.count === 'all' ? this.collection.total : trigger.count
        condition = this.collection.count >= needed
      }
      if (condition === null) continue
      if (condition && !brick.shown) this.schedule(brick, brick.config.delay)
      else if (!condition) {
        this.scheduled.delete(brick.id)
        if (brick.shown) brick.hide()
      }
    }

    for (const brick of this.bricks) {
      if (!brick.holder.visible && !this.isScreenUi(brick)) continue
      try {
        brick.update(this.elapsed, dt, this.view)
      } catch (err) {
        report('error', `La brique « ${brick.id} » : ${errorMessage(err)}`)
      }
    }

    if (this.anyActive) this.callBehaviors('onUpdate', this.elapsed / 1000, dt / 1000)
  }

  private camWorld = new THREE.Vector3()
  private camLocal = new THREE.Vector3()

  private get currentPoster(): Poster {
    return this.posters.get(this.current ?? this.ids[0]) ?? [...this.posters.values()][0]
  }

  private updateView(): void {
    const poster = this.currentPoster
    if (!poster) return
    this.stage.camera.getWorldPosition(this.camWorld)
    poster.root.updateWorldMatrix(true, false)
    this.camLocal.copy(this.camWorld)
    poster.root.worldToLocal(this.camLocal)
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
    if (!this.anyActive) return
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
    const poster = this.currentPoster
    const planeHit = poster ? this.raycaster.intersectObject(poster.tapPlane, false)[0] : undefined
    let x: number | null = null
    let y: number | null = null
    if (planeHit) {
      const local = poster.root.worldToLocal(planeHit.point.clone())
      const p = fromLocal(poster.ratio, local)
      x = p.x
      y = p.y
    }
    this.handleTap({brick: hitBrick?.id ?? null, x, y})
  }

  // Also used by the preview's "simulate tap" button.
  handleTap(hit: TapHit): void {
    for (const brick of this.bricks) {
      const {trigger, delay} = brick.config
      if (trigger.type !== 'tap' || !this.posterActive(brick.posterId)) continue
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
    const collection = this.collection
    return Object.freeze({
      THREE,
      get poster() {
        return runtime.currentPoster.root
      },
      get target() {
        return runtime.current
      },
      mode: this.stage.mode,
      view: this.view,
      device: this.device,
      get tracked() {
        return runtime.tracked.size > 0
      },
      bricks: Object.freeze({
        get: (id: string) => handles.get(id),
        list: () => [...handles.values()],
        show: (id: string) => handles.get(id)?.show(),
        hide: (id: string) => handles.get(id)?.hide(),
      }),
      collection: Object.freeze({
        has: (id: string) => collection.has(id),
        list: () => collection.list(),
        get count() {
          return collection.count
        },
        get total() {
          return collection.total
        },
        get complete() {
          return collection.complete
        },
      }),
      toLocal: (x: number, y: number, z = 0) => toLocal(runtime.currentPoster.ratio, x, y, z),
      fromLocal: (v: THREE.Vector3) => fromLocal(runtime.currentPoster.ratio, v),
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
          report('error', `Behavior « ${name} » : le fichier ${this.behaviorsBase ? '' : 'experience/'}${file} est introuvable.`)
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
