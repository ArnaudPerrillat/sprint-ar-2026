// Global sound: one master switch (off by default, toggled by the UI sound button), WebAudio for
// short sounds and loops. Videos listen to the switch to mute/unmute themselves.

import {experienceUrl} from './env'
import {report} from '../ui/errors'

export interface PlayOptions {
  loop?: boolean
  volume?: number
}

export interface SoundHandle {
  stop(): void
}

export class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buffers = new Map<string, Promise<AudioBuffer | null>>()
  private listeners = new Set<(enabled: boolean) => void>()
  private _enabled = false

  get enabled(): boolean {
    return this._enabled
  }

  // Must be called from a user gesture (start button, sound button) for iOS.
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as {webkitAudioContext: typeof AudioContext}).webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
        this.master = this.ctx.createGain()
        this.master.gain.value = this._enabled ? 1 : 0
        this.master.connect(this.ctx.destination)
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume()
    } catch (err) {
      console.warn('[affiche-ra] audio unlock failed', err)
    }
  }

  setEnabled(enabled: boolean): void {
    if (enabled) this.unlock()
    this._enabled = enabled
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(enabled ? 1 : 0, this.ctx.currentTime, 0.05)
    this.listeners.forEach((cb) => cb(enabled))
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled)
    return this._enabled
  }

  onChange(cb: (enabled: boolean) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private load(path: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(path)
    if (!p) {
      p = (async () => {
        this.unlock()
        if (!this.ctx) return null
        try {
          const res = await fetch(experienceUrl(path))
          if (!res.ok) throw new Error(String(res.status))
          return await this.ctx.decodeAudioData(await res.arrayBuffer())
        } catch {
          report('error', `Son : impossible de charger « ${path} » (fichier absent ou format non supporté, préfère .mp3).`)
          return null
        }
      })()
      this.buffers.set(path, p)
    }
    return p
  }

  // Plays a file from experience/ (e.g. "assets/pop.mp3"). Silent while sound is switched off.
  play(path: string, options: PlayOptions = {}): SoundHandle {
    let source: AudioBufferSourceNode | null = null
    let stopped = false
    void this.load(path).then((buffer) => {
      if (!buffer || stopped || !this.ctx || !this.master) return
      source = this.ctx.createBufferSource()
      source.buffer = buffer
      source.loop = !!options.loop
      const gain = this.ctx.createGain()
      gain.gain.value = Math.max(0, Math.min(1, options.volume ?? 1))
      source.connect(gain).connect(this.master)
      source.start()
    })
    return {
      stop: () => {
        stopped = true
        try {
          source?.stop()
        } catch {
          // already stopped
        }
      },
    }
  }
}
