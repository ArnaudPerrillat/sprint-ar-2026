// ctx.shared: small lists shared by every visitor of a poster (e.g. a collaborative playlist).
// Stored in the teacher's Firestore (project sprint-ar-2026), through its REST API: no SDK, no
// dependency. Security lives in firebase/firestore.rules: read + create only, a few typed
// fields (deezerId, texte, nombre), no update, no delete. The API key below is a public web key,
// meant to be in client code.

const PROJECT = 'sprint-ar-2026'
const API_KEY = 'AIzaSyCEQJITAP08DlcjeUzvGZIX5MsCTWvCA1c'
const DB = `projects/${PROJECT}/databases/(default)/documents`
const BASE = `https://firestore.googleapis.com/v1/${DB}`
const ID_RE = /^[a-z0-9-]{3,40}$/
const MAX_ITEMS = 500
const TIMEOUT_MS = 8000
// Client-side brake against a stuck button: the rules cannot count, the console can clean up.
const MAX_ADDS_PER_MINUTE = 5
const WATCH_MS = 5000

export interface SharedItem {
  id: string
  deezerId?: number
  texte?: string
  nombre?: number
  // Milliseconds since 1970 (server time of the addition).
  date: number
}

export type SharedValue = Partial<Pick<SharedItem, 'deezerId' | 'texte' | 'nombre'>>

type FirestoreValue = {integerValue?: string; doubleValue?: number; stringValue?: string; timestampValue?: string}

const fail = (message: string): never => {
  throw new Error(`ctx.shared : ${message}`)
}

const checkList = (list: string): void => {
  if (typeof list !== 'string' || !ID_RE.test(list)) {
    fail(`nom de liste « ${list} » invalide : 3 à 40 caractères, minuscules, chiffres ou - (ex. "playlist").`)
  }
}

const toFields = (value: SharedValue): Record<string, FirestoreValue> => {
  if (!value || typeof value !== 'object') fail('ajoute un objet, ex. { deezerId: 3135556 }.')
  const fields: Record<string, FirestoreValue> = {}
  for (const [key, v] of Object.entries(value)) {
    if (key === 'deezerId') {
      if (!Number.isInteger(v) || (v as number) <= 0) fail('deezerId doit être un nombre entier (l\'id du morceau Deezer).')
      fields.deezerId = {integerValue: String(v)}
    } else if (key === 'texte') {
      if (typeof v !== 'string' || !v.trim() || v.length > 140) fail('texte : 1 à 140 caractères.')
      fields.texte = {stringValue: v as string}
    } else if (key === 'nombre') {
      if (typeof v !== 'number' || !Number.isFinite(v)) fail('nombre doit être un nombre.')
      fields.nombre = {doubleValue: v as number}
    } else {
      fail(`champ « ${key} » non autorisé (seulement deezerId, texte, nombre).`)
    }
  }
  if (!Object.keys(fields).length) fail('ajoute au moins un champ : deezerId, texte ou nombre.')
  return fields
}

const fromDoc = (doc: {name: string; fields?: Record<string, FirestoreValue>}): SharedItem => {
  const f = doc.fields ?? {}
  const item: SharedItem = {id: doc.name.split('/').pop() ?? '', date: Date.parse(f.createdAt?.timestampValue ?? '') || 0}
  if (f.deezerId?.integerValue) item.deezerId = Number(f.deezerId.integerValue)
  if (f.texte?.stringValue !== undefined) item.texte = f.texte.stringValue
  if (f.nombre) item.nombre = f.nombre.doubleValue ?? Number(f.nombre.integerValue)
  return item
}

const request = async (url: string, body: unknown): Promise<unknown> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${url}?key=${API_KEY}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    if (res.status === 403) fail('refusé par la base (valeur non autorisée ?).')
    if (res.status === 409) fail('cet élément existe déjà.')
    if (res.status === 429) fail('trop de requêtes, réessaie dans un moment.')
    if (!res.ok) fail(`la base a répondu ${res.status}.`)
    return await res.json()
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('ctx.shared')) throw err
    return fail(controller.signal.aborted ? 'la base ne répond pas (connexion lente ?).' : 'base injoignable (pas de réseau ?).')
  } finally {
    clearTimeout(timer)
  }
}

export class Shared {
  private adds: number[] = []
  // Active watch() refreshers per list: an add() refreshes them at once.
  private watchers = new Map<string, Set<() => void>>()

  // project: the "shared" key of experience.json (null when absent).
  constructor(private readonly project: string | null) {}

  private root(): string {
    if (!this.project) fail('ajoute "shared": "<id fourni par ton enseignant>" dans experience.json.')
    return `${BASE}/projets/${this.project}`
  }

  async add(list: string, value: SharedValue): Promise<SharedItem> {
    checkList(list)
    this.root()
    const fields = toFields(value)
    const now = Date.now()
    this.adds = this.adds.filter((t) => now - t < 60_000)
    if (this.adds.length >= MAX_ADDS_PER_MINUTE) fail('trop d\'ajouts d\'un coup, attends une minute.')
    this.adds.push(now)
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 20)
    const name = `${DB}/projets/${this.project}/${list}/${id}`
    const res = await request(`${BASE}:commit`, {
      writes: [{
        update: {name, fields},
        currentDocument: {exists: false},
        updateTransforms: [{fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME'}],
      }],
    }) as {commitTime?: string}
    this.watchers.get(list)?.forEach((refresh) => refresh())
    return {id, ...value, date: Date.parse(res.commitTime ?? '') || now}
  }

  // Oldest first.
  async list(list: string): Promise<SharedItem[]> {
    checkList(list)
    const res = await request(`${this.root()}:runQuery`, {
      structuredQuery: {
        from: [{collectionId: list}],
        orderBy: [{field: {fieldPath: 'createdAt'}, direction: 'ASCENDING'}],
        limit: MAX_ITEMS,
      },
    }) as {document?: {name: string; fields?: Record<string, FirestoreValue>}}[]
    return res.filter((r) => r.document).map((r) => fromDoc(r.document!))
  }

  // Calls back with the whole list now, then every time it changes (checked every 5 s while
  // the page is visible, and as soon as it becomes visible again). Returns a function that stops.
  watch(list: string, callback: (items: SharedItem[]) => void, onError?: (err: Error) => void): () => void {
    checkList(list)
    let stopped = false
    let last: string | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async (force = false) => {
      clearTimeout(timer)
      if (stopped) return
      if (force || document.visibilityState === 'visible') {
        try {
          const items = await this.list(list)
          const key = items.map((i) => i.id).join(',')
          if (!stopped && key !== last) {
            last = key
            callback(items)
          }
        } catch (err) {
          onError?.(err as Error)
        }
      }
      if (!stopped) timer = setTimeout(tick, WATCH_MS)
    }
    const onVisible = () => document.visibilityState === 'visible' && void tick()
    const refresh = () => void tick(true)
    document.addEventListener('visibilitychange', onVisible)
    if (!this.watchers.has(list)) this.watchers.set(list, new Set())
    this.watchers.get(list)!.add(refresh)
    void tick(true)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      this.watchers.get(list)?.delete(refresh)
    }
  }
}
