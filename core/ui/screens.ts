// Full-screen messages for AR mode (French): start, loading, aim guide, fatal errors, credits.

import type {Experience} from '../schema/schema'
import {ENGINE_LICENSE_URL} from '../ar/engine-loader'
import {urlWithParams, isIOS} from '../util/env'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, html = ''): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag)
  node.className = className
  if (html) node.innerHTML = html
  return node
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]!))

export const showStartScreen = (experience: Experience): Promise<void> =>
  new Promise((resolve) => {
    const screen = el('section', 'ra-screen ra-start', `
      <div class="ra-start-inner">
        <h1>${escapeHtml(experience.title)}</h1>
        ${experience.author ? `<p class="ra-start-author">${escapeHtml(experience.author)}</p>` : ''}
        <button type="button" class="ra-primary">Démarrer l'expérience</button>
        <p class="ra-start-hint">Autorise l'accès à la caméra, puis vise l'affiche.</p>
        <a class="ra-start-preview" href="${urlWithParams({preview: '1', ar: null})}">Voir l'aperçu sans caméra</a>
      </div>`)
    screen.querySelector('button')!.addEventListener('click', async () => {
      // iOS 13+: motion sensors need an explicit permission, from a user gesture.
      const DOE = window.DeviceOrientationEvent as unknown as {requestPermission?: () => Promise<string>}
      if (typeof DOE?.requestPermission === 'function') {
        try {
          await DOE.requestPermission()
        } catch {
          // Refused or unavailable: behaviors simply get zeros.
        }
      }
      screen.remove()
      resolve()
    }, {once: true})
    document.body.appendChild(screen)
  })

let loading: HTMLElement | null = null

export const showLoading = (message: string): void => {
  if (!loading) {
    loading = el('section', 'ra-screen ra-loading', '<div class="ra-spinner"></div><p></p>')
    document.body.appendChild(loading)
  }
  loading.querySelector('p')!.textContent = message
}

export const hideLoading = (): void => {
  loading?.remove()
  loading = null
}

export const showFatal = (title: string, text: string): void => {
  hideLoading()
  const screen = el('section', 'ra-screen ra-fatal', `
    <div class="ra-start-inner">
      <h1>${escapeHtml(title)}</h1>
      <p>${text}</p>
      <button type="button" class="ra-primary">Réessayer</button>
      <a class="ra-start-preview" href="${urlWithParams({preview: '1', ar: null})}">Voir l'aperçu sans caméra</a>
    </div>`)
  screen.querySelector('button')!.addEventListener('click', () => location.reload())
  document.body.appendChild(screen)
}

export const cameraErrorText = (): string =>
  isIOS
    ? 'L\'accès à la caméra a été refusé. Dans Réglages › Safari › Appareil photo, choisis « Autoriser », puis recharge la page.'
    : 'L\'accès à la caméra a été refusé. Touche l\'icône à gauche de l\'adresse, autorise la caméra, puis recharge la page.'

// "Aim at the poster" guide, shown while the target is not tracked.
export const createAimGuide = (): {set(visible: boolean): void} => {
  const guide = el('div', 'ra-aim', `
    <div class="ra-aim-frame"><span></span><span></span><span></span><span></span></div>
    <p>Vise toute l'affiche, en pleine lumière</p>`)
  document.body.appendChild(guide)
  let timer: number | undefined
  return {
    set(visible: boolean) {
      clearTimeout(timer)
      if (visible) {
        // Short losses are common: wait a bit before nagging.
        timer = window.setTimeout(() => guide.classList.add('is-visible'), 1500)
      } else {
        guide.classList.remove('is-visible')
      }
    },
  }
}

export const showCredits = (): void => {
  const credit = el('footer', 'ra-credit')
  credit.innerHTML = `Moteur XR © 2026 Niantic Spatial, Inc. — fourni « en l'état », sans garantie, ` +
    `sous <a href="${ENGINE_LICENSE_URL}" target="_blank" rel="noopener">XR Engine License Agreement</a>`
  document.body.appendChild(credit)
}

export const showCoreModifiedBanner = (): void => {
  const banner = el('div', 'ra-core-banner', 'Le dossier <code>core/</code> a été modifié : l\'AR risque de ne plus marcher. Préviens ton enseignant.')
  document.body.appendChild(banner)
}
