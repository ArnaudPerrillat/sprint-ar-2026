// Posters found so far, remembered on the phone (localStorage) so a collection survives reloads.
// Falls back on memory only when storage is unavailable (private browsing, blocked storage).

export class Collection {
  private found = new Set<string>()
  private listeners = new Set<(collection: Collection, added: string | null) => void>()
  private readonly key: string

  constructor(readonly ids: readonly string[], scope: string) {
    this.key = `affiche-ra:collection:${location.pathname}:${scope}`
    try {
      const saved = JSON.parse(localStorage.getItem(this.key) ?? '[]')
      if (Array.isArray(saved)) saved.filter((id) => ids.includes(id)).forEach((id) => this.found.add(id))
    } catch {
      // No storage: start empty.
    }
  }

  get total(): number {
    return this.ids.length
  }

  get count(): number {
    return this.found.size
  }

  get complete(): boolean {
    return this.found.size >= this.ids.length
  }

  has(id: string): boolean {
    return this.found.has(id)
  }

  list(): string[] {
    return this.ids.filter((id) => this.found.has(id))
  }

  // Returns true when the poster was not collected yet.
  add(id: string): boolean {
    if (!this.ids.includes(id) || this.found.has(id)) return false
    this.found.add(id)
    this.save()
    this.listeners.forEach((cb) => cb(this, id))
    return true
  }

  reset(): void {
    this.found.clear()
    this.save()
    this.listeners.forEach((cb) => cb(this, null))
  }

  onChange(cb: (collection: Collection, added: string | null) => void): void {
    this.listeners.add(cb)
  }

  private save(): void {
    try {
      localStorage.setItem(this.key, JSON.stringify([...this.found]))
    } catch {
      // Storage unavailable: the collection only lives until the page is closed.
    }
  }
}
