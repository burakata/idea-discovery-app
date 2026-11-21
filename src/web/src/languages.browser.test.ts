import { describe, expect, it } from 'vitest'
import { browserLang } from './languages'

describe('the browser language', () => {
  it('takes the first supported language, by its main part', () => {
    expect(browserLang(['tr-TR', 'en-GB'])).toBe('tr')
    expect(browserLang(['de', 'TR', 'en'])).toBe('tr')
    expect(browserLang(['en-US'])).toBe('en')
  })

  it('falls back to English when none is supported or none is given', () => {
    expect(browserLang(['de-DE', 'fr'])).toBe('en')
    expect(browserLang([])).toBe('en')
  })
})
