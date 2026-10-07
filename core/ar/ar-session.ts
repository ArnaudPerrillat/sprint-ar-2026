// AR stage: 8th Wall camera pipeline + three.js scene + image target tracking.
// Mirrors the official threejs example (8thwall/threejs-world-effects-example) with world tracking
// disabled, as in the official image targets example.

import * as THREE from 'three'
import type {Stage, StageEvents} from '../stage'
import type {LoadedTarget} from './target'
import {createAnchorDebug, fitPosterToTarget} from './poster-anchor'
import {loadEngine, type XR8Api} from './engine-loader'
import {fullWindowCanvasModule} from './full-window-canvas'
import {query} from '../util/env'

export type ArStatus =
  | {kind: 'engine-loading'}
  | {kind: 'camera-requesting'}
  | {kind: 'running'}
  | {kind: 'error'; reason: 'engine' | 'camera' | 'browser' | 'runtime'; detail?: string}

interface ImageDetail {
  name: string
  position: {x: number; y: number; z: number}
  rotation: {x: number; y: number; z: number; w: number}
  scale: number
}

export class ArStage implements Stage {
  readonly mode = 'ar' as const
  scene!: THREE.Scene
  camera!: THREE.Camera
  renderer!: THREE.WebGLRenderer
  readonly posterRoot = new THREE.Group()
  private readonly targetGroup = new THREE.Group()
  private last = performance.now()

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly target: LoadedTarget,
    private readonly onStatus: (status: ArStatus) => void,
  ) {
    this.targetGroup.name = 'image-target'
    this.targetGroup.visible = false
    this.targetGroup.add(this.posterRoot)
    fitPosterToTarget(this.posterRoot, target.poster)
    if (query.debug === 'anchor') this.posterRoot.add(createAnchorDebug(target.poster))
  }

  async start(events: StageEvents): Promise<void> {
    this.onStatus({kind: 'engine-loading'})
    let XR8: XR8Api
    try {
      XR8 = await loadEngine()
    } catch (err) {
      this.onStatus({kind: 'error', reason: 'engine', detail: String(err)})
      throw err
    }

    if (!XR8.XrDevice.isDeviceBrowserCompatible({allowedDevices: XR8.XrConfig.device().ANY})) {
      this.onStatus({kind: 'error', reason: 'browser'})
      throw new Error('incompatible browser')
    }

    // XR8.Threejs.pipelineModule() requires a global THREE.
    window.THREE = THREE

    const targetName = this.target.data!.name
    const applyPose = (detail: ImageDetail) => {
      this.targetGroup.position.set(detail.position.x, detail.position.y, detail.position.z)
      this.targetGroup.quaternion.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w)
      this.targetGroup.scale.setScalar(detail.scale)
    }

    let resolveStart!: () => void
    const started = new Promise<void>((resolve) => (resolveStart = resolve))

    const appModule = {
      name: 'affiche-ra',
      onStart: () => {
        const {scene, camera, renderer} = XR8.Threejs.xrScene()
        this.scene = scene
        this.camera = camera
        this.renderer = renderer
        renderer.outputColorSpace = THREE.SRGBColorSpace
        scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.4))
        const dir = new THREE.DirectionalLight(0xffffff, 1.2)
        dir.position.set(1, 2, 3)
        scene.add(dir)
        scene.add(this.targetGroup)
        camera.position.set(0, 0, 0)
        XR8.XrController.updateCameraProjectionMatrix({origin: camera.position, facing: camera.quaternion})
        this.canvas.addEventListener('touchmove', (e) => e.preventDefault(), {passive: false})
        this.canvas.addEventListener('click', (e) => events.tap(e.clientX, e.clientY))
        this.onStatus({kind: 'running'})
        resolveStart()
      },
      onUpdate: () => {
        const now = performance.now()
        const dt = now - this.last
        this.last = now
        events.frame(now, dt)
      },
      onCameraStatusChange: ({status}: {status: string}) => {
        if (status === 'requesting') this.onStatus({kind: 'camera-requesting'})
        else if (status === 'failed') this.onStatus({kind: 'error', reason: 'camera'})
      },
      onException: (error: unknown) => {
        console.error('[affiche-ra] XR exception', error)
        this.onStatus({kind: 'error', reason: 'runtime', detail: String(error)})
      },
      listeners: [
        {
          event: 'reality.imagefound',
          process: ({detail}: {detail: ImageDetail}) => {
            if (detail.name !== targetName) return
            applyPose(detail)
            this.targetGroup.visible = true
            events.found()
          },
        },
        {
          event: 'reality.imageupdated',
          process: ({detail}: {detail: ImageDetail}) => {
            if (detail.name === targetName) applyPose(detail)
          },
        },
        {
          event: 'reality.imagelost',
          process: ({detail}: {detail: ImageDetail}) => {
            if (detail.name === targetName) events.lost()
          },
        },
      ],
    }

    XR8.XrController.configure({
      disableWorldTracking: true,
      imageTargetData: [this.target.data],
    })

    XR8.addCameraPipelineModules([
      XR8.GlTextureRenderer.pipelineModule(),
      XR8.Threejs.pipelineModule(),
      XR8.XrController.pipelineModule(),
      fullWindowCanvasModule(XR8),
      appModule,
    ])

    XR8.run({canvas: this.canvas, allowedDevices: XR8.XrConfig.device().ANY})
    await started
  }
}
