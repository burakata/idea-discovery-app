import { describe, expect, it } from 'vitest'
import en from './en'
import tr from './tr'
import { fill, isEnglishOnly, screenLang } from './index'

describe('fill', () => {
  it('puts values into placeholders and leaves unknown ones', () => {
    expect(fill('Hi {name}, {name}! {other}', { name: 'Elif' })).toBe('Hi Elif, Elif! {other}')
  })

  it('has the placeholder the screens fill, in both languages', () => {
    for (const strings of [en, tr]) {
      expect(strings.auth.home.sent).toContain('{email}')
      expect(strings.auth.signedInAs).toContain('{name}')
    }
  })
})

describe("Burak's project list", () => {
  it('is English only for him, and in the reader language for owners', () => {
    expect(screenLang('/', 'tr', true)).toBe('en')
    expect(screenLang('/', 'tr', false)).toBe('tr')
    expect(isEnglishOnly('/sign-in', true)).toBe(false)
  })
})
