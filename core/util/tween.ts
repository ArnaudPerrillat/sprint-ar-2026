// Minimal tween engine driven by the runtime's frame loop.

export type Easing = (t: number) => number

export const easings = {
  linear: (t: number) => t,
  easeIn: (t: number) => t * t * t,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  backOut: (t: number) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  elasticOut: (t: number) => {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  },
} satisfies Record<string, Easing>

export type EasingName = keyof typeof easings

export interface TweenOptions {
  from?: number
  to?: number
  duration?: number
  delay?: number
  easing?: EasingName | Easing
  onUpdate: (value: number) => void
  onComplete?: () => void
}

export interface TweenHandle {
  cancel(): void
  readonly done: boolean
}

interface ActiveTween {
  opts: Required<Omit<TweenOptions, 'onComplete' | 'easing'>> & {onComplete?: () => void; easing: Easing}
  elapsed: number
  done: boolean
}

export class Tweens {
  private active = new Set<ActiveTween>()

  add(options: TweenOptions): TweenHandle {
    const easing = typeof options.easing === 'function'
      ? options.easing
      : easings[options.easing ?? 'easeOut'] ?? easings.easeOut
    const tween: ActiveTween = {
      opts: {
        from: options.from ?? 0,
        to: options.to ?? 1,
        duration: Math.max(0, options.duration ?? 600),
        delay: Math.max(0, options.delay ?? 0),
        onUpdate: options.onUpdate,
        onComplete: options.onComplete,
        easing,
      },
      elapsed: 0,
      done: false,
    }
    this.active.add(tween)
    if (tween.opts.delay === 0 && tween.opts.duration === 0) this.step(tween, 0)
    return {
      cancel: () => {
        tween.done = true
        this.active.delete(tween)
      },
      get done() {
        return tween.done
      },
    }
  }

  update(dtMs: number): void {
    for (const tween of this.active) this.step(tween, dtMs)
  }

  private step(tween: ActiveTween, dtMs: number): void {
    if (tween.done) return
    tween.elapsed += dtMs
    const {from, to, duration, delay, easing, onUpdate, onComplete} = tween.opts
    const t = tween.elapsed - delay
    if (t < 0) return
    const k = duration === 0 ? 1 : Math.min(1, t / duration)
    onUpdate(from + (to - from) * easing(k))
    if (k >= 1) {
      tween.done = true
      this.active.delete(tween)
      onComplete?.()
    }
  }

  clear(): void {
    for (const t of this.active) t.done = true
    this.active.clear()
  }
}
