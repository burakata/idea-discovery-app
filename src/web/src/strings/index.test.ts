import { describe, expect, it } from 'vitest'
import en from './en'
import tr from './tr'
import { isEnglishOnly, pickText, screenLang, translationLine } from './index'

describe('screenLang', () => {
  it('keeps the consultant screens in English whatever the viewer language', () => {
    for (const path of ['/rooms', '/rooms/', '/p/idea/queue', '/p/idea/queue/', '/p/idea/notes']) {
      expect(isEnglishOnly(path)).toBe(true)
      expect(screenLang(path, 'tr')).toBe('en')
    }
  })

  it('uses the viewer language on every other screen', () => {
    for (const path of ['/', '/rooms/abc', '/p/idea', '/p/idea/discussion', '/p/idea/summary']) {
      expect(isEnglishOnly(path)).toBe(false)
      expect(screenLang(path, 'tr')).toBe('tr')
      expect(screenLang(path, 'en')).toBe('en')
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
      placeholder: en.discussion.translationPlaceholder,
    })
    expect(translationLine({ lang: 'en', text: 'Hi', translation: 'Selam' }, 'tr', tr)?.label).toBe(
      tr.discussion.translated,
    )
  })

  it('still returns the line, with no text, when the translation is not there yet', () => {
    const line = translationLine({ lang: 'tr', text: 'Selam' }, 'en', en)
    expect(line?.text).toBeUndefined()
    expect(line?.placeholder).toBe(en.discussion.translationPlaceholder)
  })
})
