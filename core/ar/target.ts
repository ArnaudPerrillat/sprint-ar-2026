// Loads the image target produced by @8thwall/image-target-cli (or scripts/build-targets.ts)
// from experience/target/, and describes the poster geometry the rest of the core relies on.

import {experienceUrl} from '../util/env'
import {report} from '../ui/errors'

// Shape of the JSON written by @8thwall/image-target-cli 1.0.0 (src/apply.js).
export interface ImageTargetData {
  imagePath: string
  metadata: null
  name: string
  type: 'PLANAR' | 'CYLINDER' | 'CONICAL'
  properties: {
    top: number
    left: number
    width: number
    height: number
    isRotated?: boolean
    originalWidth: number
    originalHeight: number
  }
  resources: {
    originalImage: string
    croppedImage: string
    thumbnailImage: string
    luminanceImage: string
    geometryImage?: string
    // Added by scripts/build-targets.ts: the untouched, upright poster (for preview mode).
    posterImage?: string
  }
  created?: number
  updated?: number
}

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface PosterInfo {
  // Poster size in pixels, as the student sees it (upright).
  width: number
  height: number
  // height / width
  ratio: number
  // Tracked region (3:4 crop chosen by the CLI) in upright poster pixels.
  crop: Rect
  // Image to show in preview mode, and how many quarter turns it needs to be upright.
  imageUrl: string | null
  imageQuarterTurns: number
}

export interface LoadedTarget {
  // Data handed to XR8.XrController.configure({imageTargetData}), with imagePath made absolute.
  data: ImageTargetData | null
  poster: PosterInfo
}

// A3 portrait, used when no target is present so preview still renders.
const FALLBACK_POSTER: PosterInfo = {
  width: 2970,
  height: 4200,
  ratio: 4200 / 2970,
  crop: {left: 0, top: 124, width: 2970, height: 3960},
  imageUrl: null,
  imageQuarterTurns: 0,
}

// Converts the CLI crop (stored in the coordinates of the possibly rotated image) back to the
// upright poster. The CLI rotates landscape crops by 90° clockwise (sharp.rotate(90)) before
// storing them; see selectPlanarGeometry() in the CLI's interactive.js for the inverse mapping.
export const uprightCrop = (p: ImageTargetData['properties']): {poster: {width: number; height: number}; crop: Rect} => {
  if (!p.isRotated) {
    return {
      poster: {width: p.originalWidth, height: p.originalHeight},
      crop: {left: p.left, top: p.top, width: p.width, height: p.height},
    }
  }
  const uprightHeight = p.originalWidth
  return {
    poster: {width: p.originalHeight, height: p.originalWidth},
    crop: {left: p.top, top: uprightHeight - p.left - p.width, width: p.height, height: p.width},
  }
}

export const loadTarget = async (fileName: string): Promise<LoadedTarget> => {
  const jsonUrl = experienceUrl(`target/${fileName}`)
  let data: ImageTargetData
  try {
    const res = await fetch(jsonUrl, {cache: 'no-cache'})
    if (!res.ok) throw new Error(String(res.status))
    data = await res.json()
  } catch {
    report('error', `Aucune cible trouvée : le fichier experience/target/${fileName} est absent ou illisible. ` +
      'Demande à ton enseignant le dossier de cible de ton affiche et dépose son contenu dans experience/target/.')
    return {data: null, poster: FALLBACK_POSTER}
  }

  if (data.type !== 'PLANAR') {
    report('warning', `La cible est de type ${data.type} : ce template est prévu pour des affiches planes (PLANAR).`)
  }

  const {poster, crop} = uprightCrop(data.properties)
  const posterImage = data.resources.posterImage ?? data.resources.originalImage
  const imageQuarterTurns = !data.resources.posterImage && data.properties.isRotated ? -1 : 0

  return {
    data: {...data, imagePath: experienceUrl(`target/${data.resources.luminanceImage}`)},
    poster: {
      width: poster.width,
      height: poster.height,
      ratio: poster.height / poster.width,
      crop,
      imageUrl: posterImage ? experienceUrl(`target/${posterImage}`) : null,
      imageQuarterTurns,
    },
  }
}
