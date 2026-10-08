// AR stage: 8th Wall camera pipeline + three.js scene + image target tracking.
// Mirrors the official threejs example (8thwall/threejs-world-effects-example) with world tracking
// disabled, as in the official image targets example. Several posters can be tracked at once
// (the engine supports up to 32 image targets): one anchored group per poster.

import * as THREE from 'three'
import type {Stage, StageEvents} from '../stage'
import type {PosterTarget} from './target'
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
  readonly posterRoots = new Map<string, THREE.Group>()
  // Engine target name -> {poster id, group driven by the tracked pose}.
  private readonly anchors = new Map<string, {id: string; group: THREE.Group}>()
  private last = performance.now()

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly targets: PosterTarget[],
    private readonly onStatus: (status: ArStatus) => void,
  ) {
    for (const target of targets) {
      const group = new THREE.Group()
      group.name = `image-target:${target.id}`
      group.visible = false
      const posterRoot = new THREE.Group()
      posterRoot.name = `poster:${target.id}`
      group.add(posterRoot)
      fitPosterToTarget(posterRoot, target.poster)
      if (query.debug === 'anchor') posterRoot.add(createAnchorDebug(target.poster))
      this.posterRoots.set(target.id, posterRoot)
      if (target.data) this.anchors.set(target.data.name, {id: target.id, group})
    }
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

    const applyPose = (group: THREE.Group, detail: ImageDetail) => {
      group.position.set(detail.position.x, detail.position.y, detail.position.z)
      group.quaternion.set(detail.rotation.x, detail.rotation.y, detail.rotation.z, detail.rotation.w)
      group.scale.setScalar(detail.scale)
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
        for (const {group} of this.anchors.values()) scene.add(group)
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
            const anchor = this.anchors.get(detail.name)
            if (!anchor) return
            applyPose(anchor.group, detail)
            anchor.group.visible = true
            events.found(anchor.id)
          },
        },
        {
          event: 'reality.imageupdated',
          process: ({detail}: {detail: ImageDetail}) => {
            const anchor = this.anchors.get(detail.name)
            if (anchor) applyPose(anchor.group, detail)
          },
        },
        {
          event: 'reality.imagelost',
          process: ({detail}: {detail: ImageDetail}) => {
            const anchor = this.anchors.get(detail.name)
            if (anchor) events.lost(anchor.id)
          },
        },
      ],
    }

    XR8.XrController.configure({
      disableWorldTracking: true,
      imageTargetData: this.targets.filter((t) => t.data).map((t) => t.data),
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
