// Debug bar shown in preview mode (French UI).

import QRCode from 'qrcode'
import type {PreviewStage} from './preview'
import type {Runtime} from '../runtime'
import {isInIframe, query, urlWithParams} from '../util/env'

const EXAMPLES: [string, string][] = [
  ['', 'Mon expérience'],
  ['01-typons', 'Exemple 1 · typons'],
  ['02-video', 'Exemple 2 · vidéo'],
  ['03-modele', 'Exemple 3 · modèle 3D'],
  ['04-behavior', 'Exemple 4 · behavior'],
  ['05-puzzle', 'Exemple 5 · puzzle (4 affiches)'],
]

const button = (label: string, title: string, onClick: () => void): HTMLButtonElement => {
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = label
  b.title = title
  b.addEventListener('click', onClick)
  return b
}

const showQr = async () => {
  const url = urlWithParams({preview: null})
  const dialog = document.createElement('div')
  dialog.className = 'ra-modal'
  const img = new Image()
  img.alt = 'QR code de cette page'
  img.src = await QRCode.toDataURL(url, {margin: 1, width: 360})
  dialog.innerHTML = `
    <div class="ra-modal-card">
      <p class="ra-modal-url"></p>
      <p class="ra-modal-note">${isInIframe
        ? 'Tu es dans un aperçu intégré (AI Studio…) : cette adresse ne marchera sans doute pas sur téléphone. Utilise plutôt l\'adresse GitHub Pages de ton projet.'
        : 'Scanne avec l\'appareil photo du téléphone, puis vise l\'affiche.'}</p>
      <button type="button">Fermer</button>
    </div>`
  dialog.querySelector('.ra-modal-card')!.prepend(img)
  dialog.querySelector('.ra-modal-url')!.textContent = url
  const close = () => dialog.remove()
  dialog.querySelector('button')!.addEventListener('click', close)
  dialog.addEventListener('click', (e) => e.target === dialog && close())
  document.body.appendChild(dialog)
}

export const mountDebugBar = (stage: PreviewStage, runtime: Runtime): void => {
  const bar = document.createElement('nav')
  bar.className = 'ra-debug'
  bar.setAttribute('aria-label', 'Outils d\'aperçu')

  const status = document.createElement('span')
  status.className = 'ra-debug-status'
  const readout = document.createElement('span')
  readout.className = 'ra-debug-readout'

  const setStatus = (tracked: boolean) => {
    status.textContent = tracked ? 'Affiche détectée' : 'Affiche perdue'
    status.classList.toggle('is-on', tracked)
  }
  setStatus(false)
  runtime.onTrackingChange(setStatus)

  const arLink = document.createElement('a')
  arLink.href = urlWithParams({preview: null, ar: '1'})
  arLink.target = isInIframe ? '_blank' : '_self'
  arLink.textContent = 'Ouvrir en AR'
  arLink.title = 'Lancer la vraie AR avec la caméra (sur téléphone, ou webcam d\'ordinateur)'

  // Switch between the student's experience and the bundled examples (reloads the page).
  const examples = document.createElement('select')
  examples.title = 'Voir un exemple (ton experience.json n\'est pas modifié)'
  examples.setAttribute('aria-label', 'Exemples')
  for (const [value, label] of EXAMPLES) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = label
    option.selected = value === query.example
    examples.appendChild(option)
  }
  examples.addEventListener('change', () => {
    location.href = urlWithParams({exemple: examples.value || null})
  })

  // Several posters: pick the one "in front of the camera" (switching = lost + found).
  const posterTools: HTMLElement[] = []
  if (stage.ids.length > 1) {
    const posters = document.createElement('select')
    posters.title = 'Affiche visée par le téléphone simulé'
    posters.setAttribute('aria-label', 'Affiche visée')
    for (const id of stage.ids) {
      const option = document.createElement('option')
      option.value = id
      option.textContent = `▣ ${id}`
      posters.appendChild(option)
    }
    posters.addEventListener('change', () => stage.switchTo(posters.value))
    posterTools.push(posters)
  }
  if (stage.ids.length > 1 || runtime.experience.bricks.some((b) => b.type === 'collection')) {
    posterTools.push(button('↺ Collection', 'Vider la collection mémorisée (comme un nouveau visiteur)', () => runtime.collection.reset()))
  }

  bar.append(
    examples,
    ...posterTools,
    status,
    button('▶ Détection', 'Rejoue l\'expérience comme si l\'affiche venait d\'être trouvée', () => stage.simulateFound()),
    button('■ Perte', 'Comme si la caméra ne voyait plus l\'affiche', () => stage.simulateLost()),
    button('Tap', 'Un tap sur l\'affiche (tu peux aussi cliquer directement sur les éléments)', () =>
      runtime.handleTap({brick: null, x: 0.5, y: 0.5})),
    button('Recentrer', 'Revenir face à l\'affiche', () => stage.resetView()),
    readout,
    button('QR', 'Afficher un QR code de cette page', () => void showQr()),
    arLink,
  )
  document.body.appendChild(bar)
  // Lets the CTA / collection grid sit above the bar, whatever its height (it may wrap).
  new ResizeObserver(() => document.body.style.setProperty('--ra-debug-h', `${bar.offsetHeight}px`)).observe(bar)

  let acc = 0
  let last = performance.now()
  const tick = () => {
    const now = performance.now()
    acc += now - last
    last = now
    if (acc > 120) {
      acc = 0
      const {tilt, distance} = runtime.view
      readout.textContent = `${Math.round(tilt)}° · dist. ${distance.toFixed(2)}`
    }
    requestAnimationFrame(tick)
  }
  tick()
}
