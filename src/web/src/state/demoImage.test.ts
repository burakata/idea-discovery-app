import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { projects } from '../projects'
import {
  checkImage,
  DEMO_IMAGE_MAX_BYTES,
  imageUrlOf,
  imageVersionOf,
  removeImage,
  setImage,
  sniffImageType,
  toDataUrl,
} from './demoImage'
import { roomOf } from './demoRoom'
import { createInitialState } from './demoStore'
import { showsHeroImage } from './roomRules'

const bytes = (...values: number[]) => new Uint8Array(values)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 1, 2)
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50, 1)
const text = (value: string) => new TextEncoder().encode(value)

function refusal(run: () => unknown): ApiError {
  try {
    run()
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected a refusal')
}

describe('the demo project image: what it accepts', () => {
  it('knows PNG, JPEG and WebP by their first bytes', () => {
    expect(sniffImageType(PNG)).toBe('image/png')
    expect(sniffImageType(JPEG)).toBe('image/jpeg')
    expect(sniffImageType(WEBP)).toBe('image/webp')
  })

  it('refuses SVG, GIF, PDF, HTML and a RIFF file that is not WebP', () => {
    for (const other of [
      text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      text('GIF89a....'),
      text('%PDF-1.4'),
      text('<html></html>'),
      bytes(0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x41, 0x56, 0x45),
      bytes(),
      bytes(0x89, 0x50),
    ]) {
      const failure = refusal(() => checkImage(other))
      expect([failure.status, failure.code]).toEqual([400, 'image_not_valid'])
    }
  })

  it('limits the size to about 1 MB, with the same 413 as the API', () => {
    const atLimit = new Uint8Array(DEMO_IMAGE_MAX_BYTES)
    atLimit.set(PNG)
    expect(checkImage(atLimit)).toBe('image/png')
    const over = new Uint8Array(DEMO_IMAGE_MAX_BYTES + 1)
    over.set(PNG)
    expect(refusal(() => checkImage(over)).status).toBe(413)
  })

  it('makes a data URL of the sniffed type, whatever the file claimed', () => {
    expect(toDataUrl(JPEG, 'image/jpeg')).toBe('data:image/jpeg;base64,/9j/4AEC')
  })
})

describe('the demo project image: its life', () => {
  const home = projects[0].id

  it('has none at first, and the room says so', () => {
    const state = createInitialState()
    expect(imageVersionOf(state, home)).toBeNull()
    expect(roomOf(state, home).imageVersion).toBeNull()
  })

  it('sets one, gives a new version when replaced, and removes it', () => {
    const first = setImage(createInitialState(), home, 'data:image/png;base64,AAA')
    const version = imageVersionOf(first, home)!
    expect(roomOf(first, home).imageVersion).toBe(version)
    expect(imageUrlOf(first, home, version)).toBe('data:image/png;base64,AAA')

    const second = setImage(first, home, 'data:image/png;base64,BBB')
    expect(imageVersionOf(second, home)).not.toBe(version)
    // The old version's address no longer shows anything.
    expect(imageUrlOf(second, home, version)).toBe('')

    const gone = removeImage(second, home)
    expect(imageVersionOf(gone, home)).toBeNull()
    expect(roomOf(gone, home).imageVersion).toBeNull()
  })

  it('keeps one project image out of another project', () => {
    const state = setImage(createInitialState(), home, 'data:image/png;base64,AAA')
    expect(imageVersionOf(state, projects[1].id)).toBeNull()
  })
})

describe('the idea page hero', () => {
  it('shows the image when there is one, and the illustration when there is none or that version failed', () => {
    expect(showsHeroImage('v1', null)).toBe(true)
    expect(showsHeroImage(null, null)).toBe(false)
    expect(showsHeroImage('v1', 'v1')).toBe(false)
    // A new image after a failed one gets its chance.
    expect(showsHeroImage('v2', 'v1')).toBe(true)
  })
})
