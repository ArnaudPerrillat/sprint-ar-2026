// Fingerprint of core/ (line endings normalised so Windows checkouts hash the same).
// The sealed value lives in core/integrity.json, which is itself excluded from the hash.

import {createHash} from 'node:crypto'
import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs'
import {join, relative, sep} from 'node:path'

export const INTEGRITY_FILE = 'integrity.json'

const listFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? listFiles(full) : [full]
  })

export const computeCoreHash = (root: string): string => {
  const coreDir = join(root, 'core')
  const hash = createHash('sha256')
  const files = listFiles(coreDir)
    .map((f) => relative(coreDir, f).split(sep).join('/'))
    .filter((f) => f !== INTEGRITY_FILE)
    .sort()
  for (const file of files) {
    const content = readFileSync(join(coreDir, file), 'utf8').replace(/\r\n/g, '\n')
    hash.update(`${file}\n${content}\n`)
  }
  return hash.digest('hex')
}

export const readSealedHash = (root: string): string | null => {
  const file = join(root, 'core', INTEGRITY_FILE)
  if (!existsSync(file)) return null
  try {
    return JSON.parse(readFileSync(file, 'utf8')).sha256 ?? null
  } catch {
    return null
  }
}

export const isCoreIntact = (root: string): boolean => {
  const sealed = readSealedHash(root)
  // Not sealed yet (template under development): consider it intact.
  return sealed === null || sealed === computeCoreHash(root)
}
