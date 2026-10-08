// Schema of experience/experience.json.
// Validation is done in two passes so that one broken brick never hides the others:
// 1. the top level (bricks kept as unknown[]), 2. each brick on its own.
// All user-facing messages are in French.

import {z} from 'zod'

z.config(z.locales.fr())

export const MAX_BRICKS = 3

// ---------------------------------------------------------------------------
// Shared pieces

const assetPath = z
  .string({error: 'doit être un chemin de fichier entre guillemets, ex. "assets/image.png"'})
  .regex(/^assets\/[^\s].*\.[a-zA-Z0-9]+$/, {
    error: 'doit commencer par "assets/" et finir par une extension (ex. "assets/typon.png")',
  })

const color = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {error: 'doit être une couleur hexadécimale, ex. "#ff3366"'})

const unit = (def: number) =>
  z.number().min(0, {error: 'doit être entre 0 et 1'}).max(1, {error: 'doit être entre 0 et 1'}).default(def)

const rotation = z.union([
  z.number(),
  z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    z: z.number().default(0),
  }),
])

const triggerObject = z.discriminatedUnion('type', [
  z.object({type: z.literal('found')}),
  z.object({type: z.literal('delay'), ms: z.number().min(0).max(60000).default(1000)}),
  z.object({
    type: z.literal('tap'),
    on: z.string().optional(),
    toggle: z.boolean().default(false),
  }),
  z.object({
    type: z.literal('tilt'),
    min: z.number().min(0).max(90).default(25),
    max: z.number().min(0).max(90).default(90),
  }),
  z.object({
    type: z.literal('distance'),
    near: z.number().positive().optional(),
    far: z.number().positive().optional(),
  }).refine((t) => t.near !== undefined || t.far !== undefined, {
    error: 'un déclencheur "distance" a besoin de "near" (plus proche que) ou "far" (plus loin que)',
  }),
  z.object({
    type: z.literal('collected'),
    count: z.union([z.literal('all'), z.number().int().min(1)]).default('all'),
  }),
], {error: 'type de déclencheur inconnu : utilise "found", "tap", "delay", "tilt", "distance" ou "collected"'})

const trigger = z
  .union([
    z.literal('found').transform(() => ({type: 'found' as const})),
    z.literal('tap').transform(() => ({type: 'tap' as const, on: undefined, toggle: false})),
    triggerObject,
  ], {error: 'déclencheur invalide : "found", "tap", ou un objet comme { "type": "delay", "ms": 1000 }'})
  .default({type: 'found'})

const base = {
  id: z
    .string({error: 'chaque brique a besoin d\'un "id" (un nom court, ex. "typons")'})
    .regex(/^[a-zA-Z0-9_-]+$/, {error: 'l\'id ne doit contenir que des lettres, chiffres, - ou _'}),
  // Poster the brick lives on: a "targets" id, or "*" for whichever poster is being looked at.
  target: z
    .string()
    .regex(/^(\*|[a-zA-Z0-9_-]+)$/, {error: 'doit être l\'id d\'une affiche de "targets", ou "*" (n\'importe quelle affiche)'})
    .optional(),
  trigger,
  appear: z.enum(['fade', 'pop', 'rise', 'none']).default('fade'),
  duration: z.number().min(0).max(10000).default(600),
  delay: z.number().min(0).max(60000).default(0),
  x: unit(0.5),
  y: unit(0.5),
  z: z.number().min(-2).max(2).default(0),
  rotation: rotation.default(0),
  opacity: unit(1),
}

// ---------------------------------------------------------------------------
// Bricks

const blend = z.enum(['normal', 'multiply', 'screen', 'add'])

export const layersBrick = z.object({
  ...base,
  type: z.literal('layers'),
  width: z.number().positive().max(5).default(1),
  layers: z
    .array(z.object({
      src: assetPath,
      blend: blend.default('normal'),
      depth: z.number().min(-2).max(2).optional(),
      opacity: unit(1),
    }))
    .min(1, {error: 'il faut au moins une couche dans "layers"'})
    .max(8, {error: '8 couches maximum'}),
  spread: z.number().min(0).max(1).default(0.04),
  burst: z
    .union([
      z.literal(false),
      z.object({
        duration: z.number().min(0).max(10000).default(1200),
        stagger: z.number().min(0).max(5000).default(150),
      }),
    ])
    .default({duration: 1200, stagger: 150}),
  float: z.number().min(0).max(0.2).default(0),
})

export const videoBrick = z.object({
  ...base,
  type: z.literal('video'),
  width: z.number().positive().max(5).default(0.5),
  src: assetPath,
  loop: z.boolean().default(true),
  sound: z.boolean().default(false),
  chroma: z
    .object({
      keyColor: color.default('#00ff00'),
      similarity: z.number().min(0).max(1).default(0.4),
      smoothness: z.number().min(0).max(1).default(0.08),
      spill: z.number().min(0).max(1).default(0.1),
    })
    .optional(),
})

export const modelBrick = z.object({
  ...base,
  type: z.literal('model'),
  src: assetPath,
  size: z.number().positive().max(5).default(0.4),
  animation: z.string().default('all'),
  autoRotate: z.number().default(0),
})

export const particlesBrick = z.object({
  ...base,
  type: z.literal('particles'),
  preset: z.enum(['sparkles', 'snow', 'dust', 'bubbles', 'confetti', 'ink']).default('sparkles'),
  color: z.union([color, z.array(color).min(1).max(6)]).default('#ffffff'),
  density: unit(0.5),
  direction: z.enum(['up', 'down', 'out', 'in']).optional(),
  speed: z.number().min(0).max(5).default(1),
  size: z.number().min(0.1).max(5).default(1),
  area: z
    .object({
      width: z.number().positive().max(5).default(1),
      height: z.number().positive().max(5).default(1.4),
      depth: z.number().positive().max(5).default(0.5),
    })
    .default({width: 1, height: 1.4, depth: 0.5}),
})

export const uiBrick = z.object({
  ...base,
  type: z.literal('ui'),
  appear: z.enum(['fade', 'pop', 'rise', 'none']).default('fade'),
  hotspots: z
    .array(z.object({
      x: unit(0.5),
      y: unit(0.5),
      z: z.number().min(-2).max(2).default(0),
      label: z.string().max(40).default('+'),
      text: z.string().max(600).optional(),
      link: z.url({error: 'le lien doit être une adresse complète, ex. "https://..."'}).optional(),
    }))
    .max(8)
    .default([]),
  cta: z
    .object({
      label: z.string().min(1).max(40),
      url: z.url({error: 'le lien doit être une adresse complète, ex. "https://..."'}),
    })
    .optional(),
  soundButton: z.boolean().default(false),
})

const targetId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, {error: 'id d\'affiche invalide : lettres, chiffres, - ou _'})

// Screen-space grid that fills up as posters are found (remembered on the phone).
// Always visible once the experience has started: its trigger is ignored.
export const collectionBrick = z.object({
  ...base,
  type: z.literal('collection'),
  columns: z.number().int().min(1).max(6).default(3),
  pieces: z
    .array(z.object({
      target: targetId,
      src: assetPath.optional(),
    }))
    .min(1, {error: 'il faut au moins une pièce dans "pieces"'})
    .max(16),
  position: z.enum(['bottom', 'top']).default('bottom'),
  size: z.number().min(0.15).max(0.9).default(0.4),
  hint: z.string().max(80).optional(),
  reveal: z
    .object({
      title: z.string().max(80).default('Bravo !'),
      image: assetPath.optional(),
      text: z.string().max(800).optional(),
      link: z.url({error: 'le lien doit être une adresse complète, ex. "https://..."'}).optional(),
    })
    .optional(),
})

export const brickSchemas = {
  layers: layersBrick,
  video: videoBrick,
  model: modelBrick,
  particles: particlesBrick,
  ui: uiBrick,
  collection: collectionBrick,
} as const

// Bricks that are screen UI and do not count in the "3 bricks per poster" advice.
export const UI_BRICKS = new Set(['ui', 'collection'])

export type BrickType = keyof typeof brickSchemas
export const BRICK_TYPES = Object.keys(brickSchemas) as BrickType[]

export const brick = z.discriminatedUnion('type', [layersBrick, videoBrick, modelBrick, particlesBrick, uiBrick, collectionBrick])

// ---------------------------------------------------------------------------
// Top level

const topLevelShape = {
  $schema: z.string().optional(),
  title: z.string().max(120).default('Affiche augmentée'),
  author: z.string().max(120).default(''),
  target: z.string().default('target.json'),
  // Several posters: replaces "target". Each brick then picks its poster with "target".
  targets: z
    .array(z.object({
      id: targetId,
      file: z.string().regex(/^[^/\\]+\.json$/, {error: 'nom du fichier de cible dans experience/target/, ex. "piece-1.json"'}),
    }))
    .min(1)
    .max(16, {error: '16 affiches maximum'})
    .optional(),
  onLost: z.enum(['hide', 'freeze']).default('hide'),
  replayOnFound: z.boolean().default(true),
  theme: z
    .object({
      color: color.default('#ff3b30'),
      textColor: color.default('#ffffff'),
      font: z.string().default('system-ui'),
    })
    .default({color: '#ff3b30', textColor: '#ffffff', font: 'system-ui'}),
  behaviors: z
    .array(z.string().regex(/^[a-zA-Z0-9_-]+$/, {
      error: 'nom de behavior invalide : lettres, chiffres, - ou _ (sans ".js")',
    }))
    .max(5)
    .default([]),
}

const topLevel = z.object({...topLevelShape, bricks: z.array(z.unknown()).default([])})

// Full schema, only used to export JSON Schema for editor autocompletion.
export const experienceSchema = z.object({...topLevelShape, bricks: z.array(brick).default([])})

export type Experience = z.output<typeof experienceSchema>
export type Brick = z.output<typeof brick>
export type LayersBrick = z.output<typeof layersBrick>
export type VideoBrick = z.output<typeof videoBrick>
export type ModelBrick = z.output<typeof modelBrick>
export type ParticlesBrick = z.output<typeof particlesBrick>
export type UiBrick = z.output<typeof uiBrick>
export type CollectionBrick = z.output<typeof collectionBrick>

// Poster ids of an experience: the "targets" ids, or a single implicit "main" poster.
export const SINGLE_TARGET_ID = 'main'
export const targetIds = (exp: {targets?: {id: string}[]}): string[] =>
  exp.targets?.map((t) => t.id) ?? [SINGLE_TARGET_ID]

// Poster a brick is attached to: its "target", or the first poster.
export const brickTarget = (b: {target?: string}, ids: string[]): string => b.target ?? ids[0]
export type Trigger = Brick['trigger']

// ---------------------------------------------------------------------------
// Validation with readable, French messages

export interface Issue {
  level: 'error' | 'warning'
  message: string
}

const formatPath = (path: PropertyKey[]): string =>
  path
    .map((p) => (typeof p === 'number' ? `n°${p + 1}` : String(p)))
    .join(' › ')

const brickLabel = (index: number, raw: unknown): string => {
  const id = raw && typeof raw === 'object' && 'id' in raw ? String((raw as {id: unknown}).id) : null
  return id ? `La brique ${index + 1} (« ${id} »)` : `La brique ${index + 1}`
}

const describeIssues = (prefix: string, error: z.ZodError): string[] =>
  error.issues.map((issue) => {
    const where = issue.path.length ? ` › ${formatPath(issue.path)}` : ''
    // Missing field: make the message explicit about which field.
    if (issue.code === 'invalid_type' && issue.input === undefined && issue.path.length) {
      const field = String(issue.path[issue.path.length - 1])
      return `${prefix} : il manque le champ "${field}"${issue.path.length > 1 ? where : ''}`
    }
    return `${prefix}${where} : ${issue.message}`
  })

export interface ValidationResult {
  experience: Experience
  issues: Issue[]
}

export const parseJsonText = (text: string): {data?: unknown; issue?: Issue} => {
  try {
    return {data: JSON.parse(text)}
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    const posMatch = msg.match(/position (\d+)/)
    let where = ''
    if (posMatch) {
      const pos = Number(posMatch[1])
      const before = text.slice(0, pos)
      const line = before.split('\n').length
      const col = pos - before.lastIndexOf('\n')
      where = ` (ligne ${line}, colonne ${col})`
    }
    return {
      issue: {
        level: 'error',
        message: `experience.json n'est pas un JSON valide${where}. ` +
          'Vérifie les virgules (pas de virgule après le dernier élément), les guillemets droits "..." et les accolades.',
      },
    }
  }
}

export const validateExperience = (data: unknown): ValidationResult => {
  const issues: Issue[] = []
  const top = topLevel.safeParse(data)
  let topData: z.output<typeof topLevel>
  if (top.success) {
    topData = top.data
  } else {
    describeIssues('experience.json', top.error).forEach((message) => issues.push({level: 'error', message}))
    // Fall back on defaults but keep whatever bricks we can read.
    const bricksRaw = data && typeof data === 'object' && Array.isArray((data as {bricks?: unknown}).bricks)
      ? (data as {bricks: unknown[]}).bricks
      : []
    topData = topLevel.parse({bricks: bricksRaw})
  }

  const bricks: Brick[] = []
  const seenIds = new Set<string>()
  topData.bricks.forEach((raw, index) => {
    const label = brickLabel(index, raw)
    const type = raw && typeof raw === 'object' ? (raw as {type?: unknown}).type : undefined
    if (typeof type !== 'string' || !(type in brickSchemas)) {
      issues.push({
        level: 'error',
        message: `${label} : "type" doit être l'un de ${BRICK_TYPES.map((t) => `"${t}"`).join(', ')}` +
          (type !== undefined ? ` (reçu : ${JSON.stringify(type)})` : ''),
      })
      return
    }
    const result = brickSchemas[type as BrickType].safeParse(raw)
    if (!result.success) {
      describeIssues(label, result.error).forEach((message) => issues.push({level: 'error', message}))
      return
    }
    if (seenIds.has(result.data.id)) {
      issues.push({level: 'error', message: `${label} : l'id « ${result.data.id} » est déjà utilisé par une autre brique`})
      return
    }
    seenIds.add(result.data.id)
    bricks.push(result.data as Brick)
  })

  // Posters: unique ids, and every brick / collection piece must point at an existing one.
  const ids = targetIds(topData)
  if (topData.targets && new Set(ids).size !== ids.length) {
    issues.push({level: 'error', message: 'experience.json › targets : deux affiches ont le même "id".'})
  }
  const known = (id: string) => ids.includes(id)
  const multi = !!topData.targets
  const kept = bricks.filter((b) => {
    if (b.target && b.target !== '*' && !known(b.target)) {
      issues.push({
        level: 'error',
        message: multi
          ? `La brique « ${b.id} » : l'affiche « ${b.target} » n'existe pas dans "targets" (${ids.map((i) => `"${i}"`).join(', ')}, ou "*").`
          : `La brique « ${b.id} » : "target" ne sert que s'il y a plusieurs affiches (liste "targets"). Retire-le.`,
      })
      return false
    }
    if (b.type === 'collection') {
      const unknown = b.pieces.filter((p) => !known(p.target))
      if (unknown.length) {
        issues.push({
          level: 'error',
          message: `La brique « ${b.id} » : ${unknown.map((p) => `« ${p.target} »`).join(', ')} n'existe pas dans "targets".`,
        })
        return false
      }
    }
    return true
  })
  bricks.length = 0
  bricks.push(...kept)

  for (const id of ids) {
    const counted = bricks.filter((b) => !UI_BRICKS.has(b.type) && (b.target === '*' || brickTarget(b, ids) === id)).length
    if (counted > MAX_BRICKS) {
      issues.push({
        level: 'warning',
        message: `${counted} briques${multi ? ` sur l'affiche « ${id} »` : ''} (hors "ui" et "collection") : on conseille ${MAX_BRICKS} maximum par affiche, pour la lisibilité et les performances sur téléphone.`,
      })
    }
  }

  // Tap triggers pointing at an unknown brick.
  for (const b of bricks) {
    if (b.trigger.type === 'tap' && b.trigger.on && b.trigger.on !== 'self' && !seenIds.has(b.trigger.on)) {
      issues.push({
        level: 'warning',
        message: `La brique « ${b.id} » : le déclencheur tap vise « ${b.trigger.on} », qui n'existe pas.`,
      })
    }
  }

  return {experience: {...topData, bricks}, issues}
}
