// "video" brick: a video plane on the poster. Always muted + playsinline (autoplay rules); the
// sound button unmutes it when "sound": true. Transparency via a chroma key shader, because
// WebM alpha does not work on iOS Safari.

import * as THREE from 'three'
import type {VideoBrick} from '../schema/schema'
import {BrickBase} from './brick'
import {experienceUrl} from '../util/env'

const hexToRgb = (hex: string): THREE.Vector3 => {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// Chroma key in the U/V plane (same approach as OBS's chroma key filter). Keying happens in sRGB,
// output goes back through three's output color space conversion.
const chromaFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 keyColor;
  uniform float similarity;
  uniform float smoothness;
  uniform float spill;
  uniform float uOpacity;
  varying vec2 vUv;

  vec2 rgbToUv(vec3 rgb) {
    return vec2(
      rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
      rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
    );
  }

  void main() {
    vec3 rgb = sRGBTransferOETF(texture2D(map, vUv)).rgb;
    float base = distance(rgbToUv(rgb), rgbToUv(keyColor)) - similarity;
    float alpha = pow(clamp(base / max(smoothness, 0.0001), 0.0, 1.0), 1.5);
    float spillValue = pow(clamp(base / max(spill, 0.0001), 0.0, 1.0), 1.5);
    float luma = clamp(dot(rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
    rgb = mix(vec3(luma), rgb, spillValue);
    gl_FragColor = sRGBTransferEOTF(vec4(rgb, alpha * uOpacity));
    #include <colorspace_fragment>
  }
`

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export class VideoBrickImpl extends BrickBase<VideoBrick> {
  private video!: HTMLVideoElement
  private mesh: THREE.Mesh | null = null
  private unsubscribe: (() => void) | null = null

  async load(): Promise<void> {
    const {src, loop, width, chroma} = this.config
    const video = document.createElement('video')
    video.src = experienceUrl(src)
    video.crossOrigin = 'anonymous'
    video.loop = loop
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')
    video.setAttribute('muted', '')
    video.preload = 'auto'
    this.video = video

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`la vidéo « ${src} » met trop de temps à charger`)), 20000)
      video.addEventListener('loadedmetadata', () => {
        clearTimeout(timer)
        resolve()
      }, {once: true})
      video.addEventListener('error', () => {
        clearTimeout(timer)
        reject(new Error(`impossible de charger la vidéo « ${src} » (fichier absent ou format non supporté : utilise du .mp4 H.264)`))
      }, {once: true})
      video.load()
    })

    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = THREE.SRGBColorSpace
    const height = width * (video.videoHeight / video.videoWidth || 1)
    let material: THREE.Material
    if (chroma) {
      material = new THREE.ShaderMaterial({
        uniforms: {
          map: {value: texture},
          keyColor: {value: hexToRgb(chroma.keyColor)},
          similarity: {value: chroma.similarity},
          smoothness: {value: chroma.smoothness},
          spill: {value: chroma.spill},
          uOpacity: {value: 1},
        },
        vertexShader: vertex,
        fragmentShader: chromaFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    } else {
      material = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide, transparent: true})
    }
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material)
    this.mesh.name = `${this.id}:video`
    this.mesh.renderOrder = 20
    this.content.add(this.mesh)

    if (this.config.sound) {
      this.unsubscribe = this.env.sound.onChange((enabled) => {
        video.muted = !enabled
      })
    }
  }

  protected onShow(): void {
    if (!this.video) return
    this.video.currentTime = 0
    this.video.muted = !(this.config.sound && this.env.sound.enabled)
    this.video.play().catch(() => {
      // Autoplay refused (rare when muted): retry on the next user tap anywhere.
      const retry = () => void this.video.play().catch(() => undefined)
      window.addEventListener('pointerdown', retry, {once: true})
    })
  }

  protected onHidden(): void {
    this.video?.pause()
  }

  hitObjects(): THREE.Object3D[] {
    return this.mesh ? [this.mesh] : []
  }

  dispose(): void {
    this.unsubscribe?.()
    this.video?.pause()
    super.dispose()
  }
}
