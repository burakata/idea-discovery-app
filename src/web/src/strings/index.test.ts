import { describe, expect, it } from 'vitest'
import en from './en'
import tr from './tr'
import { isEnglishOnly, pickText, screenLang, translationLine } from './index'

describe('screenLang', () => {
  it('keeps the consultant screens in English whatever the viewer language', () => {
    for (const path of ['/projects/idea/queue', '/projects/idea/queue/', '/projects/idea/notes']) {
      expect(isEnglishOnly(path)).toBe(true)
      expect(screenLang(path, 'tr')).toBe('en')
    }
  })

  it('uses the viewer language on the room screens, even for a project called queue or notes', () => {
    for (const path of [
      '/projects/idea',
      '/projects/idea/discussion',
      '/projects/idea/summary',
      '/projects/queue',
      '/projects/notes/summary',
    ]) {
      expect(isEnglishOnly(path)).toBe(false)
      expect(isEnglishOnly(path, true)).toBe(false)
      expect(screenLang(path, 'tr')).toBe('tr')
      expect(screenLang(path, 'en')).toBe('en')
    }
  })

  it('uses the viewer language on the home page, except for the consultant', () => {
    expect(isEnglishOnly('/')).toBe(false)
    expect(screenLang('/', 'tr')).toBe('tr')
    expect(isEnglishOnly('/', true)).toBe(true)
  })

  it('keeps the consultant forms and people screen in English for the consultant only', () => {
    for (const path of ['/projects/new', '/projects/idea/edit', '/projects/idea/people']) {
      expect(isEnglishOnly(path, true)).toBe(true)
      expect(isEnglishOnly(path)).toBe(false)
    }
  })
})

describe('pickText', () => {
  it('returns the reader language when it exists', () => {
    expect(pickText({ en: 'Hello', tr: 'Merhaba' }, 'tr')).toEqual({ text: 'Merhaba', missing: false })
    expect(pickText({ en: 'Hello', tr: 'Merhaba' }, 'en')).toEqual({ text: 'Hello', missing: false })
  })

  it('falls back to the other language and marks it missing', () => {
    expect(pickText({ en: 'Hello' }, 'tr')).toEqual({ text: 'Hello', missing: true })
    expect(pickText({ tr: 'Merhaba' }, 'en')).toEqual({ text: 'Merhaba', missing: true })
  })

  it('treats empty text as missing', () => {
    expect(pickText({ en: '', tr: 'Merhaba' }, 'en')).toEqual({ text: 'Merhaba', missing: true })
  })

  it('returns empty missing text when neither language exists', () => {
    expect(pickText({}, 'en')).toEqual({ text: '', missing: true })
    expect(pickText({ en: '', tr: '' }, 'tr')).toEqual({ text: '', missing: true })
  })
})

describe('translationLine', () => {
  it('has no translation line when the text is in the reader language', () => {
    expect(translationLine({ lang: 'en', text: 'Hi' }, 'en', en)).toBeUndefined()
    expect(translationLine({ lang: 'tr', text: 'Selam', translation: 'Hi' }, 'tr', tr)).toBeUndefined()
  })

  it('shows the translation with its label when the language differs', () => {
    expect(translationLine({ lang: 'tr', text: 'Selam', translation: 'Hi' }, 'en', en)).toEqual({
      label: en.discussion.translated,
      text: 'Hi',
    })
    expect(translationLine({ lang: 'en', text: 'Hi', translation: 'Selam' }, 'tr', tr)?.label).toBe(
      tr.discussion.translated,
    )
  })

  // Burak decided on 2026-11-26: until a real translation exists (M2), nothing is shown, not a placeholder.
  it('shows no line when the translation is not there yet', () => {
    expect(translationLine({ lang: 'tr', text: 'Selam' }, 'en', en)).toBeUndefined()
    expect(translationLine({ lang: 'tr', text: 'Selam', translation: '' }, 'en', en)).toBeUndefined()
  })
})
