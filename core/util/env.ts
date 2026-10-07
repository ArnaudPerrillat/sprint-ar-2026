// Environment detection and URL helpers.

const params = new URLSearchParams(location.search)

export const query = {
  preview: params.get('preview') === '1',
  ar: params.get('ar') === '1',
  debug: params.get('debug') ?? '',
  example: /^[\w-]+$/.test(params.get('exemple') ?? '') ? params.get('exemple')! : '',
}

export const isInIframe = (() => {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
})()

export const isMobile = (() => {
  const ua = navigator.userAgent
  // iPadOS reports itself as Mac: detect touch support as well.
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOs
})()

export const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)

export const hasCamera = !!navigator.mediaDevices?.getUserMedia

export type Mode = 'ar' | 'preview'

export const chooseMode = (): Mode => {
  if (query.preview) return 'preview'
  if (query.ar) return 'ar'
  if (isInIframe || !hasCamera || !isMobile || !window.isSecureContext) return 'preview'
  return 'ar'
}

// Base URL of the student zone. experience/ is Vite's publicDir, so its files are served next to
// index.html, in dev as well as on GitHub Pages (base: './').
const baseUrl = new URL('./', location.href)

export const experienceUrl = (path: string): string => new URL(path.replace(/^\.?\//, ''), baseUrl).href

export const urlWithParams = (changes: Record<string, string | null>): string => {
  const url = new URL(location.href)
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) url.searchParams.delete(key)
    else url.searchParams.set(key, value)
  }
  return url.href
}
