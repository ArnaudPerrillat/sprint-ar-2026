// "layers" brick: transparent PNGs stacked in depth. Main use: screen-printing films (one per ink)
// that start flat on the poster and peel off towards the viewer.

import * as THREE from 'three'
import type {LayersBrick} from '../schema/schema'
import {BrickBase, loadTexture} from './brick'
import {experienceUrl} from '../util/env'
import {report, errorMessage} from '../ui/errors'
import type {TweenHandle} from '../util/tween'

const applyBlend = (material: THREE.MeshBasicMaterial, blend: LayersBrick['layers'][number]['blend']) => {
  switch (blend) {
    case 'multiply':
      // three's premultiplied MultiplyBlending: dst * (1 - a + a * src), i.e. ink on paper.
      material.blending = THREE.MultiplyBlending
      material.premultipliedAlpha = true
      break
    case 'screen':
      material.blending = THREE.CustomBlending
      material.blendEquation = THREE.AddEquation
      material.blendSrc = THREE.OneFactor
      material.blendDst = THREE.OneMinusSrcColorFactor
      material.premultipliedAlpha = true
      break
    case 'add':
      material.blending = THREE.AdditiveBlending
      break
    default:
      material.blending = THREE.NormalBlending
  }
}

export class LayersBrickImpl extends BrickBase<LayersBrick> {
  private meshes: {mesh: THREE.Mesh; depth: number; index: number}[] = []
  private burstTweens: TweenHandle[] = []
  private burstProgress: number[] = []

  async load(): Promise<void> {
    const {layers, width, spread} = this.config
    const results = await Promise.allSettled(
      layers.map((layer) => loadTexture(experienceUrl(layer.src), layer.src)),
    )
    results.forEach((result, index) => {
      const layer = layers[index]
      if (result.status === 'rejected') {
        report('error', `La brique « ${this.id} », couche ${index + 1} : ${errorMessage(result.reason)}`)
        return
      }
      const tex = result.value
      const img = tex.image as {width: number; height: number}
      const height = width * (img.height / img.width)
      const material = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: layer.opacity,
      })
      applyBlend(material, layer.blend)
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
      mesh.name = `${this.id}:layer${index + 1}`
      // Back-to-front order follows the list order (first layer = closest to the paper).
      mesh.renderOrder = 10 + index
      const depth = layer.depth ?? index * spread
      mesh.position.z = depth
      this.content.add(mesh)
      this.meshes.push({mesh, depth, index})
      this.burstProgress[index] = 1
    })
  }

  protected onShow(): void {
    const {burst} = this.config
    this.burstTweens.forEach((t) => t.cancel())
    this.burstTweens = []
    if (!burst) {
      this.meshes.forEach(({index}) => (this.burstProgress[index] = 1))
      return
    }
    this.meshes.forEach(({index}) => {
      this.burstProgress[index] = 0
      this.burstTweens.push(this.env.tweens.add({
        duration: burst.duration,
        delay: index * burst.stagger,
        easing: 'backOut',
        onUpdate: (k) => (this.burstProgress[index] = k),
      }))
    })
  }

  protected onHidden(): void {
    this.burstTweens.forEach((t) => t.cancel())
    this.burstTweens = []
  }

  update(timeMs: number): void {
    const t = timeMs / 1000
    const {float} = this.config
    for (const {mesh, depth, index} of this.meshes) {
      const k = this.burstProgress[index] ?? 1
      mesh.position.z = depth * k + (float ? float * Math.sin(t * 0.9 + index * 1.3) * k : 0)
    }
  }
}
