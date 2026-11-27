// The demo's project image, as pure functions on the demo state so the rules can be tested.
// Like the API it accepts only PNG, JPEG and WebP, decided by the file's first bytes and never
// by its name or declared type, and never SVG. Unlike the API it keeps the image as a data URL
// in local storage, so it is limited to about 1 MB. Only the demo build includes this file.
import { ApiError } from '../api/client'
import type { AppState } from './types'

export const DEMO_IMAGE_MAX_BYTES = 1024 * 1024

export type ImageType = 'image/png' | 'image/jpeg' | 'image/webp'

const startsWith = (bytes: Uint8Array, signature: number[], from = 0) =>
  bytes.length >= from + signature.length && signature.every((value, index) => bytes[from + index] === value)

// The real type, from the first bytes. Null for everything else.
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  // "RIFF", four size bytes, then "WEBP".
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp'
  }
  return null
}

// The refusals the API gives, as the same ApiErrors: 413 for too large, 400 image_not_valid.
export function checkImage(bytes: Uint8Array): ImageType {
  if (bytes.length > DEMO_IMAGE_MAX_BYTES) throw new ApiError(413, null)
  const type = sniffImageType(bytes)
  if (!type) throw new ApiError(400, 'image_not_valid')
  return type
}

export function toDataUrl(bytes: Uint8Array, type: ImageType): string {
  let binary = ''
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
  }
  return `data:${type};base64,${btoa(binary)}`
}

// A new image under a new version, replacing any earlier one.
export function setImage(state: AppState, projectId: string, dataUrl: string): AppState {
  return {
    ...state,
    seq: state.seq + 1,
    images: { ...state.images, [projectId]: { version: `i${state.seq}`, dataUrl } },
  }
}

export function removeImage(state: AppState, projectId: string): AppState {
  const { [projectId]: _removed, ...images } = state.images
  return { ...state, images }
}

export const imageVersionOf = (state: AppState, projectId: string): string | null =>
  state.images[projectId]?.version ?? null

// The data URL for the version asked for; empty when that image is gone.
export function imageUrlOf(state: AppState, projectId: string, version: string): string {
  const image = state.images[projectId]
  return image && image.version === version ? image.dataUrl : ''
}
