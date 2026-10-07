// Camera pipeline module that sizes the canvas to fill the window while matching the camera feed.
// Adapted from XRExtras.FullWindowCanvas (packages/xrextras, MIT, 8th Wall).

import type {XR8Api} from './engine-loader'

export const fullWindowCanvasModule = (XR8: XR8Api) => {
  let canvas: HTMLCanvasElement | null = null
  let orientation = 0
  const vsize = {w: 0, h: 0}

  const isCompatibleMobile = () =>
    XR8.XrDevice.isDeviceBrowserCompatible({allowedDevices: XR8.XrConfig.device().MOBILE}) &&
    !String(XR8.XrDevice.deviceEstimate().model ?? '').toLowerCase().includes('ipad')

  const fill = () => {
    if (!canvas) return
    const ww = window.innerWidth * devicePixelRatio
    const wh = window.innerHeight * devicePixelRatio
    const mismatch = ((orientation === 0 || orientation === 180) && ww > wh) ||
      ((orientation === 90 || orientation === -90) && wh > ww)
    if (mismatch && isCompatibleMobile()) {
      requestAnimationFrame(fill)
      return
    }
    const ph = Math.max(ww, wh)
    const pw = Math.min(ww, wh)
    const pa = ph / pw
    const pvh = Math.max(vsize.w, vsize.h)
    const pvw = Math.min(vsize.w, vsize.h)
    let ch = pvh
    let cw = Math.round(pvh / pa)
    if (cw > pvw) {
      cw = pvw
      ch = Math.round(pvw * pa)
    }
    if (cw > pw || ch > ph) {
      cw = pw
      ch = ph
    }
    if (ww > wh) [cw, ch] = [ch, cw]
    Object.assign(canvas.style, {width: '100%', height: '100%', display: 'block'})
    if (cw && ch) {
      canvas.width = cw
      canvas.height = ch
    }
    setTimeout(() => window.scrollTo(0, (window.scrollY + 1) % 2), 300)
  }

  const onResize = () => {
    if (!isCompatibleMobile()) fill()
  }

  return {
    name: 'ra-fullwindowcanvas',
    onAttach: (args: {canvas: HTMLCanvasElement; orientation: number; videoWidth: number; videoHeight: number}) => {
      canvas = args.canvas
      orientation = args.orientation
      vsize.w = args.videoWidth
      vsize.h = args.videoHeight
      window.addEventListener('resize', onResize)
      fill()
    },
    onDetach: () => {
      canvas = null
      window.removeEventListener('resize', onResize)
    },
    onCameraStatusChange: ({status, video}: {status: string; video?: HTMLVideoElement}) => {
      if (status !== 'hasVideo' || !video) return
      vsize.w = video.videoWidth
      vsize.h = video.videoHeight
    },
    onDeviceOrientationChange: (args: {orientation: number}) => {
      orientation = args.orientation
      fill()
    },
    onVideoSizeChange: (args: {videoWidth: number; videoHeight: number}) => {
      vsize.w = args.videoWidth
      vsize.h = args.videoHeight
      fill()
    },
    onCanvasSizeChange: fill,
    onUpdate: () => {
      if (canvas && (canvas.style.width !== '100%' || canvas.style.height !== '100%')) fill()
    },
  }
}
