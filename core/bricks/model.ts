// "model" brick: a GLB file, auto-scaled so its largest side equals "size" (in poster widths),
// centred on (x, y, z). Plays embedded animations; optional auto-rotation around its vertical axis.

import * as THREE from 'three'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {DRACOLoader} from 'three/examples/jsm/loaders/DRACOLoader.js'
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type {ModelBrick} from '../schema/schema'
import {BrickBase} from './brick'
import {experienceUrl} from '../util/env'
import {report} from '../ui/errors'

let loader: GLTFLoader | null = null

const getLoader = (): GLTFLoader => {
  if (!loader) {
    const draco = new DRACOLoader()
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    loader = new GLTFLoader()
    loader.setDRACOLoader(draco)
    loader.setMeshoptDecoder(MeshoptDecoder)
  }
  return loader
}

export class ModelBrickImpl extends BrickBase<ModelBrick> {
  private pivot = new THREE.Group()
  private mixer: THREE.AnimationMixer | null = null
  private actions: THREE.AnimationAction[] = []

  async load(): Promise<void> {
    const {src, size, animation} = this.config
    let gltf
    try {
      gltf = await getLoader().loadAsync(experienceUrl(src))
    } catch {
      throw new Error(`impossible de charger le modèle « ${src} » (fichier absent ou pas un .glb valide)`)
    }
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const dims = box.getSize(new THREE.Vector3())
    const largest = Math.max(dims.x, dims.y, dims.z) || 1
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    const wrapper = new THREE.Group()
    wrapper.add(model)
    wrapper.scale.setScalar(size / largest)
    this.pivot.add(wrapper)
    this.content.add(this.pivot)

    if (gltf.animations.length && animation !== 'none') {
      this.mixer = new THREE.AnimationMixer(model)
      const clips = animation === 'all'
        ? gltf.animations
        : gltf.animations.filter((c) => c.name === animation)
      if (!clips.length) {
        report('warning', `La brique « ${this.id} » : animation « ${animation} » introuvable. ` +
          `Disponibles : ${gltf.animations.map((c) => `"${c.name}"`).join(', ')}, ou "all" / "none".`)
      }
      this.actions = clips.map((clip) => this.mixer!.clipAction(clip))
    } else if (animation !== 'all' && animation !== 'none') {
      report('warning', `La brique « ${this.id} » : ce modèle ne contient pas d'animation.`)
    }
  }

  protected onShow(): void {
    this.actions.forEach((a) => a.reset().play())
  }

  protected onHidden(): void {
    this.actions.forEach((a) => a.stop())
  }

  update(_timeMs: number, dtMs: number): void {
    this.mixer?.update(dtMs / 1000)
    if (this.config.autoRotate) this.pivot.rotation.y += THREE.MathUtils.degToRad(this.config.autoRotate) * (dtMs / 1000)
  }
}
