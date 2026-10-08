// Public API available to experience/behaviors/*.js (advanced level).
// Use it from a behavior file with:
//   /** @type {import('../../core/behaviors').Behavior} */
//   export default { onFound(ctx) {}, onLost(ctx) {}, onTap(ctx, hit) {}, onUpdate(ctx, t, dt) {} }

import type * as THREE_NS from 'three'

export interface BrickHandle {
  readonly id: string
  readonly type: 'layers' | 'video' | 'model' | 'particles' | 'ui' | 'collection'
  // Content of the brick (move / rotate / scale it freely).
  readonly object3d: THREE_NS.Object3D
  readonly shown: boolean
  // Read-only copy of the brick as written in experience.json (with defaults applied).
  readonly config: Readonly<Record<string, unknown>>
  show(): void
  hide(): void
}

export interface View {
  // Viewing angle relative to the poster, in degrees: 0 = face on.
  readonly tilt: number
  // Signed angles, in degrees: tiltX > 0 when the phone is to the right of the poster,
  // tiltY > 0 when it is above.
  readonly tiltX: number
  readonly tiltY: number
  // Distance phone -> poster centre, in poster widths.
  readonly distance: number
}

export interface Device {
  // Phone orientation (deviceorientation event), in degrees. 0 when unavailable.
  readonly alpha: number
  readonly beta: number
  readonly gamma: number
}

export interface TweenOptions {
  from?: number
  to?: number
  duration?: number
  delay?: number
  easing?: 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'backOut' | 'elasticOut'
  onUpdate: (value: number) => void
  onComplete?: () => void
}

export interface Ctx {
  readonly THREE: typeof THREE_NS
  // Group anchored on the poster being looked at (the last one found): origin at its centre,
  // 1 unit = poster width, +Y up, +Z out.
  readonly poster: THREE_NS.Group
  // id of that poster ("main" with a single poster, or an id of "targets"); null if none in view.
  readonly target: string | null
  // Posters found so far (remembered on the phone).
  readonly collection: {
    has(targetId: string): boolean
    list(): string[]
    readonly count: number
    readonly total: number
    readonly complete: boolean
  }
  readonly mode: 'ar' | 'preview'
  readonly view: View
  readonly device: Device
  readonly tracked: boolean
  readonly bricks: {
    get(id: string): BrickHandle | undefined
    list(): BrickHandle[]
    show(id: string): void
    hide(id: string): void
  }
  // Converts poster coordinates (x, y in 0..1 from the top-left, z in poster widths) to a
  // position inside ctx.poster, and back.
  toLocal(x: number, y: number, z?: number): THREE_NS.Vector3
  fromLocal(v: THREE_NS.Vector3): {x: number; y: number; z: number}
  tween(options: TweenOptions): {cancel(): void}
  readonly sound: {
    readonly enabled: boolean
    play(path: string, options?: {loop?: boolean; volume?: number}): {stop(): void}
  }
  // Free storage for your behavior (keeps values between calls).
  readonly state: Record<string, unknown>
  // Shows a message in the on-screen panel.
  log(message: string): void
}

export interface TapHit {
  // id of the brick that was tapped, or null.
  readonly brick: string | null
  // Tapped point in poster coordinates, or null when outside the poster.
  readonly x: number | null
  readonly y: number | null
}

export interface Behavior {
  // targetId: the poster that was found / lost.
  onFound?(ctx: Ctx, targetId: string): void
  onLost?(ctx: Ctx, targetId: string): void
  onTap?(ctx: Ctx, hit: TapHit): void
  // t: time since start in seconds, dt: time since last frame in seconds.
  onUpdate?(ctx: Ctx, t: number, dt: number): void
}
