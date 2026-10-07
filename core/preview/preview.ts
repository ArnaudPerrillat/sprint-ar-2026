// Camera-less preview: the poster on a plane, OrbitControls, and debug buttons that replay the
// experience as if the target were detected. This is where students iterate in AI Studio.

import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js'
import type {Stage, StageEvents} from '../stage'
import type {PosterInfo} from '../ar/target'
import {createAnchorDebug} from '../ar/poster-anchor'
import {query} from '../util/env'

export class PreviewStage implements Stage {
  readonly mode = 'preview' as const
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly posterRoot = new THREE.Group()
  readonly controls: OrbitControls
  private events: StageEvents | null = null
  private last = performance.now()
  private homeDistance: number

  constructor(readonly canvas: HTMLCanvasElement, private readonly poster: PosterInfo) {
    this.renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha: false})
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color('#2a2a2e')
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 50)
    // Fit the whole poster with some margin.
    const fitHeight = Math.max(poster.ratio, 1 / Math.max(window.innerWidth / window.innerHeight, 0.3))
    this.homeDistance = (fitHeight / 2) / Math.tan(THREE.MathUtils.degToRad(22.5)) * 1.25
    this.camera.position.set(0, 0, this.homeDistance)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.minDistance = 0.25
    this.controls.maxDistance = 6
    this.controls.minAzimuthAngle = -THREE.MathUtils.degToRad(85)
    this.controls.maxAzimuthAngle = THREE.MathUtils.degToRad(85)
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(5)
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(175)

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2))
    const dir = new THREE.DirectionalLight(0xffffff, 1.5)
    dir.position.set(1, 2, 3)
    this.scene.add(dir)
    this.scene.add(this.posterRoot)
    this.addPoster()
    if (query.debug === 'anchor') this.posterRoot.add(createAnchorDebug(poster))
  }

  private addPoster(): void {
    const {ratio, imageUrl, imageQuarterTurns} = this.poster
    const material = new THREE.MeshBasicMaterial({color: imageUrl ? 0xffffff : 0xdedad2, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1})
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, ratio), material)
    mesh.name = 'poster'
    mesh.position.z = -0.001
    this.posterRoot.add(mesh)
    // Thin board behind the paper so the poster reads as an object in space.
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, ratio + 0.02, 0.01),
      new THREE.MeshStandardMaterial({color: 0x151515, roughness: 0.9}),
    )
    board.position.z = -0.007
    this.posterRoot.add(board)
    if (!imageUrl) return
    new THREE.TextureLoader().load(imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 8
      if (imageQuarterTurns) {
        tex.center.set(0.5, 0.5)
        tex.rotation = (Math.PI / 2) * imageQuarterTurns
      }
      material.map = tex
      material.needsUpdate = true
    })
  }

  resetView(): void {
    this.camera.position.set(0, 0, this.homeDistance)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  async start(events: StageEvents): Promise<void> {
    this.events = events
    const resize = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      this.renderer.setSize(w, h, false)
      this.canvas.style.width = `${w}px`
      this.canvas.style.height = `${h}px`
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // A tap is a short press without dragging (dragging orbits the camera).
    let down: {x: number; y: number; t: number} | null = null
    this.canvas.addEventListener('pointerdown', (e) => (down = {x: e.clientX, y: e.clientY, t: performance.now()}))
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      if (moved < 6 && performance.now() - down.t < 500) this.events?.tap(e.clientX, e.clientY)
      down = null
    })

    this.renderer.setAnimationLoop(() => {
      const now = performance.now()
      const dt = now - this.last
      this.last = now
      this.controls.update()
      this.events?.frame(now, dt)
      this.renderer.render(this.scene, this.camera)
    })
  }

  simulateFound(): void {
    this.events?.found()
  }

  simulateLost(): void {
    this.events?.lost()
  }
}
