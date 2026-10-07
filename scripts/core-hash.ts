// npm run core:seal  -> records the current fingerprint of core/ in core/integrity.json.
// Without --seal: prints whether core/ still matches the sealed fingerprint.

import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {computeCoreHash, readSealedHash, INTEGRITY_FILE} from './lib/core-hash'

const root = process.cwd()
const current = computeCoreHash(root)

if (process.argv.includes('--seal')) {
  writeFileSync(
    join(root, 'core', INTEGRITY_FILE),
    `${JSON.stringify({sha256: current, sealedAt: new Date().toISOString()}, null, 2)}\n`,
  )
  console.log(`core/ scellé : ${current.slice(0, 12)}…`)
} else {
  const sealed = readSealedHash(root)
  if (!sealed) console.log('core/ n\'est pas encore scellé (npm run core:seal).')
  else if (sealed === current) console.log('core/ intact ✔')
  else {
    console.log('⚠ core/ a été modifié depuis le scellement.')
    process.exitCode = 1
  }
}
