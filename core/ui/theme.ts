// Applies experience.theme as CSS variables (used by the UI brick, start screen, hotspots).

import type {Experience} from '../schema/schema'
import {experienceUrl} from '../util/env'
import {report} from './errors'

const SYSTEM_FONTS = new Set(['system-ui', 'sans-serif', 'serif', 'monospace'])

export const applyTheme = (theme: Experience['theme']): void => {
  const root = document.documentElement
  root.style.setProperty('--ra-color', theme.color)
  root.style.setProperty('--ra-text', theme.textColor)

  const font = theme.font.trim()
  if (SYSTEM_FONTS.has(font)) {
    root.style.setProperty('--ra-font', font)
    return
  }
  if (/^assets\/.+\.(woff2?|ttf|otf)$/i.test(font)) {
    const face = new FontFace('ra-custom', `url(${experienceUrl(font)})`)
    face.load()
      .then((loaded) => {
        document.fonts.add(loaded)
        root.style.setProperty('--ra-font', '"ra-custom", system-ui, sans-serif')
      })
      .catch(() => report('error', `Police : impossible de charger « ${font} ».`))
    return
  }
  // Otherwise: a Google Fonts family name, e.g. "Space Grotesk".
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font).replace(/%20/g, '+')}:wght@400;700&display=swap`
  link.onerror = () => report('warning', `Police « ${font} » introuvable sur Google Fonts.`)
  document.head.appendChild(link)
  root.style.setProperty('--ra-font', `"${font}", system-ui, sans-serif`)
}
