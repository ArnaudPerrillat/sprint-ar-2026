// On-screen error / warning panel. Never throws; everything the student can fix ends up here.

import type {Issue} from '../schema/schema'

const issues: Issue[] = []
const seen = new Set<string>()
let panel: HTMLElement | null = null
let list: HTMLElement | null = null
let collapsed = false

const ensurePanel = () => {
  if (panel) return
  panel = document.createElement('section')
  panel.className = 'ra-errors'
  panel.setAttribute('role', 'alert')
  panel.innerHTML = `
    <header>
      <strong class="ra-errors-title"></strong>
      <button type="button" class="ra-errors-toggle" aria-label="Réduire">–</button>
    </header>
    <ul></ul>`
  list = panel.querySelector('ul')
  panel.querySelector('.ra-errors-toggle')!.addEventListener('click', () => {
    collapsed = !collapsed
    panel!.classList.toggle('is-collapsed', collapsed)
  })
  document.body.appendChild(panel)
}

const render = () => {
  ensurePanel()
  const errors = issues.filter((i) => i.level === 'error').length
  const warnings = issues.length - errors
  const parts = []
  if (errors) parts.push(`${errors} erreur${errors > 1 ? 's' : ''}`)
  if (warnings) parts.push(`${warnings} avertissement${warnings > 1 ? 's' : ''}`)
  panel!.querySelector('.ra-errors-title')!.textContent = parts.join(' · ')
  panel!.classList.toggle('has-errors', errors > 0)
  list!.replaceChildren(...issues.map((issue) => {
    const li = document.createElement('li')
    li.className = `is-${issue.level}`
    li.textContent = issue.message
    return li
  }))
}

export const report = (level: Issue['level'], message: string): void => {
  const key = `${level}:${message}`
  if (seen.has(key)) return
  seen.add(key)
  issues.push({level, message})
  const log = level === 'error' ? console.error : console.warn
  log(`[affiche-ra] ${message}`)
  if (document.body) render()
  else window.addEventListener('DOMContentLoaded', render, {once: true})
}

export const reportAll = (list: Issue[]): void => list.forEach((i) => report(i.level, i.message))

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err)

export const getIssues = (): readonly Issue[] => issues
