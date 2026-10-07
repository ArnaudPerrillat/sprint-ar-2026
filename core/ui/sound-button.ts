// Single sound on/off button (top right). Sound is off until the viewer turns it on.

import type {Sound} from '../util/sound'

const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'

let mounted: HTMLButtonElement | null = null

export const mountSoundButton = (sound: Sound): void => {
  if (mounted) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'ra-sound'
  const render = (enabled: boolean) => {
    button.innerHTML = enabled ? ICON_ON : ICON_OFF
    button.setAttribute('aria-pressed', String(enabled))
    button.setAttribute('aria-label', enabled ? 'Couper le son' : 'Activer le son')
    button.classList.toggle('is-on', enabled)
  }
  render(sound.enabled)
  sound.onChange(render)
  // Must stay synchronous inside the click: iOS only unmutes media from a user gesture.
  button.addEventListener('click', (e) => {
    e.stopPropagation()
    sound.toggle()
  })
  document.body.appendChild(button)
  mounted = button
}
