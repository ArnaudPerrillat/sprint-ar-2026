// @8thwall/image-target-cli ships plain JS without typings.
declare module '@8thwall/image-target-cli/src/apply.js' {
  export function applyCrop(
    image: import('sharp').Sharp,
    crop: {type: 'PLANAR'; geometry: Record<string, unknown>},
    folder: string,
    name: string,
    overwriteFiles: boolean,
  ): Promise<{dataPath: string}>
}

declare module '@8thwall/image-target-cli/src/crop.js' {
  export function getDefaultCrop(
    metadata: {width: number; height: number},
    isRotated: boolean,
  ): {top: number; left: number; width: number; height: number; isRotated: boolean; originalWidth: number; originalHeight: number}
}
