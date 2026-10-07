// Entry point: load + validate the student's experience, pick AR or preview, boot the runtime.

import './ui/styles.css'
import coreIntegrity from 'virtual:core-integrity'
import {parseJsonText, validateExperience, type Experience} from './schema/schema'
import {loadTarget} from './ar/target'
import {chooseMode, experienceUrl, query} from './util/env'
import {report, reportAll, errorMessage} from './ui/errors'
import {Runtime} from './runtime'
import {PreviewStage} from './preview/preview'
import {mountDebugBar} from './preview/debug-bar'
import {applyTheme} from './ui/theme'
import {
  cameraErrorText, createAimGuide, hideLoading, showCoreModifiedBanner, showCredits, showFatal,
  showLoading, showStartScreen,
} from './ui/screens'

// ?exemple=02-video loads examples/02-video/ instead of experience/ (assets stay in experience/assets).
const exampleBase = query.example ? `examples/${query.example}/` : ''

const loadExperience = async (): Promise<Experience> => {
  let text = ''
  try {
    const res = await fetch(experienceUrl(`${exampleBase}experience.json`), {cache: 'no-cache'})
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    text = await res.text()
  } catch (err) {
    report('error', `Impossible de lire ${exampleBase || 'experience/'}experience.json (${errorMessage(err)}).`)
  }
  const {data, issue} = text ? parseJsonText(text) : {data: {}, issue: undefined}
  if (issue) report(issue.level, issue.message)
  const {experience, issues} = validateExperience(data ?? {})
  reportAll(issues)
  return experience
}

const boot = async () => {
  if (!coreIntegrity.ok) showCoreModifiedBanner()
  const canvas = document.getElementById('ra-canvas') as HTMLCanvasElement
  const experience = await loadExperience()
  applyTheme(experience.theme)
  document.title = experience.title
  const target = await loadTarget(experience.target)

  let mode = chooseMode()
  if (mode === 'ar' && !target.data) mode = 'preview'

  if (mode === 'preview') {
    document.body.classList.add('is-preview')
    const stage = new PreviewStage(canvas, target.poster)
    const runtime = new Runtime(stage, experience, target.poster, exampleBase)
    await stage.start(runtime.events)
    mountDebugBar(stage, runtime)
    await runtime.init()
    // Behave as if the poster had just been detected.
    setTimeout(() => stage.simulateFound(), 300)
    return
  }

  document.body.classList.add('is-ar')
  await showStartScreen(experience)
  const {ArStage} = await import('./ar/ar-session')
  const aim = createAimGuide()
  let runtime: Runtime | null = null
  const stage = new ArStage(canvas, target, (status) => {
    switch (status.kind) {
      case 'engine-loading':
        showLoading('Chargement du moteur AR…')
        break
      case 'camera-requesting':
        showLoading('Autorise l\'accès à la caméra')
        break
      case 'running':
        hideLoading()
        aim.set(true)
        break
      case 'error':
        if (status.reason === 'camera') showFatal('Caméra indisponible', cameraErrorText())
        else if (status.reason === 'browser') {
          showFatal('Navigateur non compatible',
            'Ouvre ce lien dans Safari (iPhone) ou Chrome (Android), pas dans l\'aperçu d\'une appli (Instagram, Messenger…).')
        } else if (status.reason === 'engine') {
          showFatal('Moteur AR non chargé', 'Vérifie ta connexion internet puis réessaie.')
        } else report('error', `Erreur AR : ${status.detail ?? 'inconnue'}`)
    }
  })
  runtime = new Runtime(stage, experience, target.poster, exampleBase)
  runtime.onTrackingChange((tracked) => aim.set(!tracked))
  // Unlock audio inside the start gesture's task.
  runtime.sound.unlock()
  showCredits()
  try {
    await stage.start(runtime.events)
  } catch (err) {
    console.error(err)
    return
  }
  await runtime.init()
}

boot().catch((err) => report('error', `Erreur au démarrage : ${errorMessage(err)}`))
