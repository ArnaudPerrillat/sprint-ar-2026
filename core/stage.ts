// A Stage is what the runtime renders into: the AR session or the camera-less preview.
// Both expose the same posterRoot, so bricks never know which one they run in.

import type * as THREE from 'three'

export interface StageEvents {
  found(): void
  lost(): void
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
  readonly posterRoot: THREE.Group
  start(events: StageEvents): Promise<void>
}
