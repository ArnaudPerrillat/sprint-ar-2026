// Brick registry: experience.json "type" -> implementation.

import type {Brick} from '../schema/schema'
import type {BrickBase, BrickEnv} from './brick'
import {LayersBrickImpl} from './layers'
import {VideoBrickImpl} from './video'
import {ModelBrickImpl} from './model'
import {ParticlesBrickImpl} from './particles'
import {UiBrickImpl} from './ui'

export const createBrick = (config: Brick, env: BrickEnv): BrickBase => {
  switch (config.type) {
    case 'layers':
      return new LayersBrickImpl(config, env)
    case 'video':
      return new VideoBrickImpl(config, env)
    case 'model':
      return new ModelBrickImpl(config, env)
    case 'particles':
      return new ParticlesBrickImpl(config, env)
    case 'ui':
      return new UiBrickImpl(config, env)
  }
}
