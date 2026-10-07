// "particles" brick: a few GPU presets in a single draw call (positions animated in the vertex
// shader, so the CPU cost does not grow with the number of particles).

import * as THREE from 'three'
import type {ParticlesBrick} from '../schema/schema'
import {BrickBase} from './brick'

const MAX_PARTICLES = 1500

type Direction = 'up' | 'down' | 'out' | 'in'

interface Preset {
  direction: Direction
  // Particle size in poster widths, and base speed in poster widths per second.
  size: number
  speed: number
  shape: number // 0 soft disc, 1 sparkle, 2 confetti, 3 bubble, 4 ink drop
  wobble: number
  additive: boolean
  twinkle: number
}

const PRESETS: Record<ParticlesBrick['preset'], Preset> = {
  sparkles: {direction: 'up', size: 0.03, speed: 0.06, shape: 1, wobble: 0.01, additive: true, twinkle: 1},
  snow: {direction: 'down', size: 0.018, speed: 0.08, shape: 0, wobble: 0.03, additive: false, twinkle: 0},
  dust: {direction: 'up', size: 0.008, speed: 0.015, shape: 0, wobble: 0.02, additive: true, twinkle: 0.5},
  bubbles: {direction: 'up', size: 0.035, speed: 0.07, shape: 3, wobble: 0.02, additive: false, twinkle: 0},
  confetti: {direction: 'down', size: 0.025, speed: 0.12, shape: 2, wobble: 0.04, additive: false, twinkle: 0},
  ink: {direction: 'out', size: 0.04, speed: 0.05, shape: 4, wobble: 0.01, additive: false, twinkle: 0},
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uSize;
  uniform float uViewport;
  uniform float uWobble;
  uniform vec3 uArea;
  uniform vec3 uDir;
  attribute vec4 aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec3 p = (aSeed.xyz - 0.5) * uArea;
    float speed = uSpeed * (0.6 + 0.8 * aSeed.w);
    vec3 travel = uDir * uTime * speed;
    // Wrap inside the area along the travel axis.
    vec3 hArea = uArea * 0.5;
    p = mod(p + travel + hArea, uArea) - hArea;
    if (uDir.z != 0.0) p.z = mod(aSeed.z * uArea.z + uTime * speed * uDir.z, uArea.z);
    p.x += sin(uTime * (0.8 + aSeed.w) + aSeed.y * 30.0) * uWobble;
    p.z += cos(uTime * (0.6 + aSeed.x) + aSeed.x * 20.0) * uWobble * 0.5;
    // Fade near the edges of the area so the wrap is invisible.
    vec3 edge = 1.0 - smoothstep(0.75, 1.0, abs(p) / max(hArea, vec3(0.0001)));
    vFade = uDir.z != 0.0 ? (1.0 - smoothstep(0.7, 1.0, p.z / uArea.z)) * edge.x * edge.y : edge.x * edge.y * edge.z;
    vColor = aColor;
    vSeed = aSeed.w;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float scale = length(modelMatrix[0].xyz);
    gl_PointSize = uSize * scale * (0.5 + aSeed.w) * projectionMatrix[1][1] * uViewport * 0.5 / -mv.z;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform int uShape;
  uniform float uTwinkle;
  varying vec3 vColor;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = 0.0;
    if (uShape == 0) {
      a = smoothstep(0.5, 0.15, d);
    } else if (uShape == 1) {
      float crs = max(smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)),
                        smoothstep(0.08, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)));
      a = max(crs, smoothstep(0.22, 0.0, d));
    } else if (uShape == 2) {
      float ang = uTime * (2.0 + vSeed * 4.0) + vSeed * 6.28;
      vec2 r = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * c;
      r.y /= 0.5 + 0.5 * abs(sin(ang * 0.7));
      a = step(abs(r.x), 0.35) * step(abs(r.y), 0.2);
    } else if (uShape == 3) {
      a = smoothstep(0.5, 0.42, d) * smoothstep(0.3, 0.42, d) + smoothstep(0.2, 0.0, length(c + vec2(0.15, 0.15))) * 0.6;
    } else {
      a = smoothstep(0.5, 0.44, d);
    }
    float tw = 1.0 - uTwinkle * 0.6 * (0.5 + 0.5 * sin(uTime * 6.0 + vSeed * 40.0));
    a *= vFade * uOpacity * tw;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a);
    #include <colorspace_fragment>
  }
`

const DIRS: Record<Direction, THREE.Vector3> = {
  up: new THREE.Vector3(0, 1, 0),
  down: new THREE.Vector3(0, -1, 0),
  out: new THREE.Vector3(0, 0, 1),
  in: new THREE.Vector3(0, 0, -1),
}

export class ParticlesBrickImpl extends BrickBase<ParticlesBrick> {
  private material: THREE.ShaderMaterial | null = null
  private time = 0

  async load(): Promise<void> {
    const cfg = this.config
    const preset = PRESETS[cfg.preset]
    const count = Math.max(20, Math.round(cfg.density * MAX_PARTICLES))
    const colors = (Array.isArray(cfg.color) ? cfg.color : [cfg.color]).map((c) => new THREE.Color(c))

    const seeds = new Float32Array(count * 4)
    const cols = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      for (let k = 0; k < 4; k++) seeds[i * 4 + k] = Math.random()
      const col = colors[i % colors.length]
      cols.set([col.r, col.g, col.b], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    // "position" is required by three but unused (positions come from aSeed).
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
    geometry.setAttribute('aColor', new THREE.BufferAttribute(cols, 3))

    const dir = DIRS[cfg.direction ?? preset.direction]
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: {value: 0},
        uSpeed: {value: preset.speed * cfg.speed},
        uSize: {value: preset.size * cfg.size},
        uViewport: {value: 1000},
        uWobble: {value: preset.wobble},
        uArea: {value: new THREE.Vector3(cfg.area.width, cfg.area.height, cfg.area.depth)},
        uDir: {value: dir.clone()},
        uOpacity: {value: 1},
        uShape: {value: preset.shape},
        uTwinkle: {value: preset.twinkle},
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: preset.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    })
    const points = new THREE.Points(geometry, this.material)
    points.frustumCulled = false
    points.renderOrder = 30
    points.name = `${this.id}:particles`
    this.content.add(points)
  }

  protected onShow(): void {
    this.time = 0
  }

  update(_timeMs: number, dtMs: number): void {
    if (!this.material) return
    this.time += dtMs / 1000
    const u = this.material.uniforms
    u.uTime.value = this.time
    u.uViewport.value = this.env.renderer.domElement.height
  }

  hitObjects(): THREE.Object3D[] {
    return []
  }
}
