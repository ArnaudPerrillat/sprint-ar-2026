// Loads the 8th Wall engine binary (Niantic Spatial XR Engine License, not MIT) from jsDelivr,
// only when AR is actually started. Version is pinned on purpose.

export const ENGINE_VERSION = '1.0.0'
export const ENGINE_BASE = `https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@${ENGINE_VERSION}/dist/`
export const ENGINE_LICENSE_URL = `${ENGINE_BASE}LICENSE`

// The engine has no published typings; we only touch a small, documented surface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type XR8Api = any

declare global {
  interface Window {
    XR8?: XR8Api
    THREE?: unknown
  }
}

let enginePromise: Promise<XR8Api> | null = null

export const loadEngine = (timeoutMs = 45000): Promise<XR8Api> => {
  if (enginePromise) return enginePromise
  enginePromise = new Promise((resolve, reject) => {
    const done = async () => {
      clearTimeout(timer)
      const XR8 = window.XR8
      try {
        // Image targets live in the "slam" chunk (XrController). It is preloaded through the
        // data-preload-chunks attribute, but load it explicitly if it is not there yet.
        if (!XR8.XrController && typeof XR8.loadChunk === 'function') await XR8.loadChunk('slam')
        resolve(XR8)
      } catch (err) {
        reject(err)
      }
    }
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    if (window.XR8) {
      void done()
      return
    }
    window.addEventListener('xrloaded', () => void done(), {once: true})
    const script = document.createElement('script')
    script.src = `${ENGINE_BASE}xr.js`
    script.async = true
    script.crossOrigin = 'anonymous'
    script.dataset.preloadChunks = 'slam'
    script.onerror = () => {
      clearTimeout(timer)
      reject(new Error('network'))
    }
    document.head.appendChild(script)
  })
  enginePromise.catch(() => (enginePromise = null))
  return enginePromise
}
