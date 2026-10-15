// Target generator page (cibles.html): students drop their poster(s), get a zip for experience/target/.

import './cibles.css'
import {zipSync, strToU8} from 'fflate'
import {GOOD_CORNERS, WEAK_CORNERS, processPoster, similarity, slug, type ProcessedTarget} from './target-processing'
import {createInspector, type View} from './inspector'
import {icon} from './icons'

interface Entry {
  id: number
  file: File
  name: string
  result: ProcessedTarget | null
  error: string | null
  busy: boolean
  view: View
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const results = $<HTMLElement>('#results')
const groupBox = $<HTMLElement>('#group')
const input = $<HTMLInputElement>('#files')
const drop = $<HTMLLabelElement>('#drop')
const groupNameInput = $<HTMLInputElement>('#group-name')

let entries: Entry[] = []
let nextId = 1
const mode = () => (document.querySelector('input[name="mode"]:checked') as HTMLInputElement).value as 'single' | 'group'

const download = (name: string, data: Uint8Array) => {
  const url = URL.createObjectURL(new Blob([data as BlobPart], {type: 'application/zip'}))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const readme = (lines: string[]) => strToU8(`${lines.join('\n')}\n`)

const targetsBlock = (names: string[]) =>
  `"targets": [\n${names.map((n) => `  { "id": "${n}", "file": "${n}.json" }`).join(',\n')}\n],`

// Unique, slugged names (the engine needs distinct target names).
const uniqueName = (wanted: string, self: Entry): string => {
  const base = slug(wanted)
  let name = base
  let i = 2
  while (entries.some((e) => e !== self && e.name === name)) name = `${base}-${i++}`
  return name
}

const process = async (entry: Entry) => {
  entry.busy = true
  entry.error = null
  render()
  try {
    entry.result = await processPoster(entry.file, entry.name)
  } catch (err) {
    entry.result = null
    entry.error = err instanceof Error ? err.message : String(err)
  }
  entry.busy = false
  render()
}

const addFiles = (files: FileList | File[]) => {
  const list = [...files].filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name))
  if (!list.length) return
  if (mode() === 'single') entries = []
  for (const file of list.slice(0, mode() === 'single' ? 1 : 16)) {
    const entry: Entry = {id: nextId++, file, name: '', result: null, error: null, busy: false, view: 'points'}
    entries.push(entry)
    entry.name = uniqueName(file.name.replace(/\.[^.]+$/, ''), entry)
    void process(entry)
  }
}

const singleZip = (r: ProcessedTarget) => {
  const files: Record<string, Uint8Array> = {
    'target.json': strToU8(`${JSON.stringify(r.json, null, 2)}\n`),
    'LISEZMOI.txt': readme([
      `Cible de l'affiche « ${r.name} » — générée le ${new Date().toLocaleString('fr-FR')}`,
      '',
      'Dépose TOUS ces fichiers dans experience/target/ de ton projet (remplace les fichiers de même nom).',
      `Reconnaissance : ${r.score.level} (${r.score.corners} points d'accroche, conseillé ≥ 18000).`,
    ]),
  }
  for (const f of r.files) files[f.name] = f.data
  download(`cible-${r.name}.zip`, zipSync(files, {level: 0}))
}

const groupZip = () => {
  const done = entries.filter((e) => e.result).map((e) => e.result!)
  const group = slug(groupNameInput.value)
  const files: Record<string, Uint8Array> = {
    'LISEZMOI.txt': readme([
      `Cibles du groupe « ${group} » (${done.length} affiches) — générées le ${new Date().toLocaleString('fr-FR')}`,
      '',
      'Dépose TOUS ces fichiers dans experience/target/ du projet du groupe.',
      'Puis colle ce bloc dans experience.json :',
      '',
      targetsBlock(done.map((r) => r.name)),
    ]),
  }
  for (const r of done) {
    files[`${r.name}.json`] = strToU8(`${JSON.stringify(r.json, null, 2)}\n`)
    for (const f of r.files) files[f.name] = f.data
  }
  download(`cibles-${group}.zip`, zipSync(files, {level: 0}))
}

// The gauge goes up to 1.5 × the "good" threshold.
const GAUGE_MAX = GOOD_CORNERS * 1.5
const gaugePct = (n: number) => Math.min(100, (n / GAUGE_MAX) * 100)

const scoreBadge = (r: ProcessedTarget) => {
  const badge = {bon: 'Bonne', moyen: 'Moyenne', faible: 'Faible'}[r.score.level]
  const advice = r.score.advice.map((a) => `<li>${a}</li>`).join('')
  const verdict = {
    bon: 'Elle sera reconnue rapidement.',
    moyen: 'Elle risque d\'être reconnue lentement : teste vite sur le tirage, ou ajoute des détails.',
    faible: 'Elle sera reconnue très lentement, voire pas du tout : retravaille-la avant le tirage.',
  }[r.score.level]
  return `<div class="tc-score is-${r.score.level}">
    <div class="tc-score-head"><span class="tc-label">Reconnaissance</span><span class="tc-badge is-${r.score.level}">${badge}</span></div>
    <div class="tc-score-value"><b>${r.score.corners.toLocaleString('fr-FR')}</b><span>points d'accroche</span></div>
    <div class="tc-gauge" role="meter" aria-valuemin="0" aria-valuemax="${GAUGE_MAX}" aria-valuenow="${r.score.corners}" aria-label="Points d'accroche">
      <span class="tc-gauge-fill" style="width:${gaugePct(r.score.corners)}%"></span>
      <i style="left:${gaugePct(WEAK_CORNERS)}%"></i><i style="left:${gaugePct(GOOD_CORNERS)}%"></i>
    </div>
    <div class="tc-gauge-scale"><span style="left:${gaugePct(WEAK_CORNERS)}%">12 000</span><span style="left:${gaugePct(GOOD_CORNERS)}%">18 000</span></div>
    <p>${verdict} Conseillé : 18&nbsp;000 et plus.</p>
  </div>
  ${advice ? `<div class="tc-alert is-warning">${icon('alert')}<strong>À améliorer</strong><ul>${advice}</ul><p class="tc-note">Les vues « Points d'accroche » et « Zones vides » montrent où en ajouter.</p></div>` : ''}`
}

const dialog = $<HTMLDialogElement>('#enlarged')
const enlarge = (e: Entry) => {
  if (!e.result) return
  dialog.querySelector('.tc-dialog-title')!.textContent = e.name
  dialog.querySelector('.tc-dialog-body')!.replaceChildren(createInspector(e.result, e.view, {
    onView: (v) => {
      e.view = v
    },
  }))
  dialog.showModal()
}
dialog.querySelector('.tc-dialog-close')!.addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (ev) => {
  if (ev.target === dialog) dialog.close()
})
// Keep the card on the view chosen in the enlarged inspector.
dialog.addEventListener('close', () => render())

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]!))

const render = () => {
  const isGroup = mode() === 'group'
  results.replaceChildren(...entries.map((e) => {
    const card = document.createElement('article')
    card.className = 'tc-card'
    const r = e.result
    card.innerHTML = `
      <div class="tc-preview">${r ? '' : `<div class="tc-placeholder${e.busy ? ' is-busy' : ''}">${e.busy ? 'Analyse de l\'affiche…' : ''}</div>`}</div>
      <div class="tc-info">
        <label class="tc-field">${isGroup ? 'Identifiant de l\'affiche' : 'Nom de la cible'} <input class="tc-input" type="text" value="${escape(e.name)}" maxlength="40"/></label>
        <p class="tc-file">${escape(e.file.name)}</p>
        ${e.error ? `<div class="tc-alert is-error">${icon('circleAlert')}<strong>Impossible de traiter ce fichier</strong><p>${escape(e.error)}</p></div>` : ''}
        ${r ? `<div class="tc-separator"></div>${scoreBadge(r)}` : ''}
        ${r ? `<p class="tc-note">Zone suivie (cadre rose) : ${Math.round(r.trackedShare * 100)} % de l'affiche. Le reste peut quand même porter du contenu.</p>` : ''}
        <div class="tc-actions">
          ${r && !isGroup ? `<button type="button" class="tc-primary" data-act="zip">${icon('download')}<span>Télécharger cible-${escape(e.name)}.zip</span></button>` : ''}
          <button type="button" class="tc-ghost" data-act="remove">Retirer</button>
        </div>
      </div>`
    if (r) {
      card.querySelector('.tc-preview')!.append(createInspector(r, e.view, {
        onView: (v) => {
          e.view = v
        },
        onEnlarge: () => enlarge(e),
      }))
    }
    const nameInput = card.querySelector('input')!
    nameInput.addEventListener('change', () => {
      e.name = uniqueName(nameInput.value, e)
      void process(e)
    })
    card.querySelector('[data-act="remove"]')!.addEventListener('click', () => {
      entries = entries.filter((x) => x !== e)
      render()
    })
    card.querySelector('[data-act="zip"]')?.addEventListener('click', () => r && singleZip(r))
    return card
  }))
  drop.classList.toggle('is-compact', entries.length > 0)
  $<HTMLElement>('.tc-drop strong').textContent = entries.length
    ? (isGroup ? 'Ajouter d\'autres affiches' : 'Changer d\'affiche')
    : (isGroup ? 'Glisse toutes les affiches du groupe ici' : 'Glisse ton affiche ici')
  renderGroup()
}

const renderGroup = () => {
  const done = entries.filter((e) => e.result)
  groupBox.hidden = mode() !== 'group' || !done.length
  if (groupBox.hidden) return
  const warnings: string[] = []
  for (let i = 0; i < done.length; i++) {
    for (let j = i + 1; j < done.length; j++) {
      const sim = similarity(done[i].result!.luminance, done[j].result!.luminance)
      if (sim > 0.5) warnings.push(`« ${done[i].name} » et « ${done[j].name} » se ressemblent trop (${Math.round(sim * 100)} %) : différencie-les davantage, sinon le téléphone risque de les confondre.`)
    }
  }
  const busy = entries.some((e) => e.busy)
  const block = targetsBlock(done.map((e) => e.name))
  groupBox.innerHTML = `
    <h2>${done.length} affiche${done.length > 1 ? 's' : ''} prête${done.length > 1 ? 's' : ''}</h2>
    ${warnings.map((w) => `<div class="tc-alert is-warning">${icon('alert')}<strong>Affiches trop proches</strong><p>${escape(w)}</p></div>`).join('')}
    <p>À coller dans <code>experience.json</code> :</p>
    <pre class="tc-block">${escape(block)}</pre>
    <div class="tc-actions">
      <button type="button" class="tc-primary" data-act="zip" ${busy ? 'disabled' : ''}>${icon('download')}<span>Télécharger cibles-${escape(slug(groupNameInput.value))}.zip</span></button>
      <button type="button" class="tc-ghost" data-act="copy">${icon('copy')}<span>Copier le bloc</span></button>
    </div>`
  const copyBtn = groupBox.querySelector<HTMLButtonElement>('[data-act="copy"]')!
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(block)
      copyBtn.innerHTML = `${icon('check')}<span>Copié</span>`
    } catch {
      copyBtn.innerHTML = '<span>Sélectionne le bloc et copie-le</span>'
    }
  })
  groupBox.querySelector('[data-act="zip"]')!.addEventListener('click', groupZip)
}

input.addEventListener('change', () => {
  if (input.files) addFiles(input.files)
  input.value = ''
})
drop.addEventListener('dragover', (e) => {
  e.preventDefault()
  drop.classList.add('is-over')
})
drop.addEventListener('dragleave', () => drop.classList.remove('is-over'))
drop.addEventListener('drop', (e) => {
  e.preventDefault()
  drop.classList.remove('is-over')
  if (e.dataTransfer?.files) addFiles(e.dataTransfer.files)
})
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="mode"]')) {
  radio.addEventListener('change', () => {
    const group = mode() === 'group'
    $<HTMLElement>('.tc-group-name').hidden = !group
    input.multiple = group
    if (!group && entries.length > 1) entries = entries.slice(0, 1)
    render()
  })
}
groupNameInput.addEventListener('input', renderGroup)
input.multiple = false
