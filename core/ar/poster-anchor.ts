// Poster space: the single coordinate system every brick works in.
//
//   posterRoot: origin at the centre of the poster, 1 unit = poster width,
//               +X right, +Y up, +Z towards the viewer.
//   Student coordinates: x, y in [0, 1] from the top-left corner, z in poster widths.
//
// In AR, posterRoot is a child of the group driven by the 8th Wall image target pose. The engine
// reports planar targets with their long side = 1 unit (scaledWidth/scaledHeight in xr-slam.js:
// `scaledWidth: isRotated ? 1 : width/height, scaledHeight: isRotated ? width/height : 1`), centred
// on the 3:4 crop chosen by the CLI. We offset and scale posterRoot so it covers the whole poster.

import * as THREE from 'three'
import type {PosterInfo} from './target'

export const toLocal = (ratio: number, x: number, y: number, z = 0): THREE.Vector3 =>
  new THREE.Vector3(x - 0.5, (0.5 - y) * ratio, z)

export const fromLocal = (ratio: number, v: THREE.Vector3): {x: number; y: number; z: number} => ({
  x: v.x + 0.5,
  y: 0.5 - v.y / ratio,
  z: v.z,
})

// Places posterRoot inside the target group (target space -> poster space).
export const fitPosterToTarget = (posterRoot: THREE.Object3D, poster: PosterInfo): void => {
  const {crop} = poster
  const unitPx = Math.max(crop.width, crop.height)
  const cx = crop.left + crop.width / 2
  const cy = crop.top + crop.height / 2
  posterRoot.scale.setScalar(poster.width / unitPx)
  posterRoot.position.set((poster.width / 2 - cx) / unitPx, -(poster.height / 2 - cy) / unitPx, 0)
  posterRoot.quaternion.identity()
}

// Debug helper (?debug=anchor): outlines the whole poster (white) and the tracked crop (magenta).
export const createAnchorDebug = (poster: PosterInfo): THREE.Group => {
  const group = new THREE.Group()
  group.name = 'anchor-debug'
  const rect = (x0: number, y0: number, x1: number, y1: number, color: number) => {
    const a = toLocal(poster.ratio, x0, y0, 0.001)
    const b = toLocal(poster.ratio, x1, y0, 0.001)
    const c = toLocal(poster.ratio, x1, y1, 0.001)
    const d = toLocal(poster.ratio, x0, y1, 0.001)
    const geo = new THREE.BufferGeometry().setFromPoints([a, b, c, d, a])
    return new THREE.Line(geo, new THREE.LineBasicMaterial({color, depthTest: false}))
  }
  group.add(rect(0, 0, 1, 1, 0xffffff))
  const {crop} = poster
  group.add(rect(
    crop.left / poster.width,
    crop.top / poster.height,
    (crop.left + crop.width) / poster.width,
    (crop.top + crop.height) / poster.height,
    0xff00ff,
  ))
  group.add(new THREE.AxesHelper(0.2))
  group.renderOrder = 1000
  return group
}
