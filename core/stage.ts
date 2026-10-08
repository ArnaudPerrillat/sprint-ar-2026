// A Stage is what the runtime renders into: the AR session or the camera-less preview.
// Both expose one posterRoot per poster, so bricks never know which one they run in.

import type * as THREE from 'three'

export interface StageEvents {
  // targetId: the poster id from experience.json ("main" for a single poster).
  found(targetId: string): void
  lost(targetId: string): void
  // Screen-space tap, in CSS pixels relative to the canvas.
  tap(clientX: number, clientY: number): void
  frame(timeMs: number, dtMs: number): void
}

export interface Stage {
  readonly mode: 'ar' | 'preview'
  readonly scene: THREE.Scene
  readonly camera: THREE.Camera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  // Poster id -> group anchored on that poster (poster space, see ar/poster-anchor.ts).
  readonly posterRoots: ReadonlyMap<string, THREE.Group>
  start(events: StageEvents): Promise<void>
}
