// Target generator page (cibles.html): students drop their poster(s), get a zip for experience/target/.

import './cibles.css'
import {zipSync, strToU8} from 'fflate'
import {processPoster, similarity, slug, type ProcessedTarget} from './target-processing'

interface Entry {
  id: number
  file: File
  name: string
  result: ProcessedTarget | null
  error: string | null
  busy: boolean
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
    const entry: Entry = {id: nextId++, file, name: '', result: null, error: null, busy: false}
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

const scoreBadge = (r: ProcessedTarget) => {
  const icon = {bon: '●', moyen: '◐', faible: '○'}[r.score.level]
  const advice = r.score.advice.map((a) => `<li>${a}</li>`).join('')
  const verdict = {
    bon: 'Elle sera reconnue rapidement.',
    moyen: 'Elle risque d\'être reconnue lentement : teste vite sur le tirage, ou ajoute des détails.',
    faible: 'Elle sera reconnue très lentement, voire pas du tout : retravaille-la avant le tirage.',
  }[r.score.level]
  return `<div class="tc-score is-${r.score.level}"><strong>${icon} Reconnaissance : ${r.score.level}</strong>
    <span>${r.score.corners.toLocaleString('fr-FR')} points d'accroche (conseillé : 18 000 et plus). ${verdict}</span>
    ${advice ? `<ul>${advice}</ul>` : ''}</div>`
}

// Tracked 3:4 zone in upright poster coordinates (inverse of the CLI rotation).
const zoneStyle = (r: ProcessedTarget) => {
  const c = r.crop
  const [W, H] = c.isRotated ? [c.originalHeight, c.originalWidth] : [c.originalWidth, c.originalHeight]
  const z = c.isRotated
    ? {left: c.top, top: H - c.left - c.width, width: c.height, height: c.width}
    : {left: c.left, top: c.top, width: c.width, height: c.height}
  return `left:${(z.left / W) * 100}%;top:${(z.top / H) * 100}%;width:${(z.width / W) * 100}%;height:${(z.height / H) * 100}%`
}

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]!))

const render = () => {
  const isGroup = mode() === 'group'
  results.replaceChildren(...entries.map((e) => {
    const card = document.createElement('article')
    card.className = 'tc-card'
    const r = e.result
    card.innerHTML = `
      <div class="tc-preview">${r ? `<img src="${r.previewUrl}" alt="Aperçu de ${escape(e.name)}"/><span class="tc-zone" style="${zoneStyle(r)}"></span>` : `<div class="tc-placeholder">${e.busy ? 'Traitement…' : ''}</div>`}</div>
      <div class="tc-info">
        <label class="tc-name">${isGroup ? 'Identifiant de l\'affiche' : 'Nom'} <input type="text" value="${escape(e.name)}" maxlength="40"/></label>
        <p class="tc-file">${escape(e.file.name)}</p>
        ${e.error ? `<p class="tc-error">✖ ${escape(e.error)}</p>` : ''}
        ${r ? scoreBadge(r) : ''}
        ${r ? `<p class="tc-note">Zone suivie (cadre) : ${Math.round(r.trackedShare * 100)} % de l'affiche. Le reste peut quand même porter du contenu.</p>` : ''}
        <div class="tc-actions">
          ${r && !isGroup ? `<button type="button" class="tc-primary" data-act="zip">Télécharger cible-${escape(e.name)}.zip</button>` : ''}
          <button type="button" class="tc-ghost" data-act="remove">Retirer</button>
        </div>
      </div>`
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
    ${warnings.map((w) => `<p class="tc-warning">⚠ ${escape(w)}</p>`).join('')}
    <p>À coller dans <code>experience.json</code> :</p>
    <pre class="tc-block">${escape(block)}</pre>
    <div class="tc-actions">
      <button type="button" class="tc-ghost" data-act="copy">Copier le bloc</button>
      <button type="button" class="tc-primary" data-act="zip" ${busy ? 'disabled' : ''}>Télécharger cibles-${escape(slug(groupNameInput.value))}.zip</button>
    </div>`
  groupBox.querySelector('[data-act="copy"]')!.addEventListener('click', async (ev) => {
    try {
      await navigator.clipboard.writeText(block)
      ;(ev.target as HTMLButtonElement).textContent = 'Copié ✔'
    } catch {
      ;(ev.target as HTMLButtonElement).textContent = 'Sélectionne le bloc et copie-le'
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
    $<HTMLElement>('.tc-drop strong').textContent = group ? 'Glisse toutes les affiches du groupe ici' : 'Glisse ton affiche ici'
    if (!group && entries.length > 1) entries = entries.slice(0, 1)
    render()
  })
}
groupNameInput.addEventListener('input', renderGroup)
input.multiple = false
