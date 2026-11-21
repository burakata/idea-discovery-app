import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, isLang, LANGS, otherLang } from './languages'

describe('languages', () => {
  it('accepts only the supported codes', () => {
    expect(isLang('en')).toBe(true)
    expect(isLang('tr')).toBe(true)
    expect(isLang('fr')).toBe(false)
    expect(isLang('EN')).toBe(false)
    expect(isLang(null)).toBe(false)
  })

  it('gives the other language of the pair', () => {
    expect(otherLang('en')).toBe('tr')
    expect(otherLang('tr')).toBe('en')
    for (const lang of LANGS) expect(otherLang(lang)).not.toBe(lang)
  })

  it('has a supported default', () => {
    expect(isLang(DEFAULT_LANG)).toBe(true)
  })
})
