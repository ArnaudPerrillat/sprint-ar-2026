// npm run schema -> core/schema/experience.schema.json (editor autocompletion for experience.json).

import {writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {z} from 'zod'
import {experienceSchema} from '../core/schema/schema.ts'

const json = z.toJSONSchema(experienceSchema, {io: 'input', unrepresentable: 'any'})
const out = join(process.cwd(), 'core', 'schema', 'experience.schema.json')
writeFileSync(out, `${JSON.stringify({...json, title: 'experience.json — affiche augmentée'}, null, 2)}\n`)
console.log(`✔ ${out}`)
