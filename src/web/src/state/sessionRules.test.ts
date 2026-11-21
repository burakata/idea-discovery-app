import { describe, expect, it } from 'vitest'
import { languageToSave } from './sessionRules'

describe('the language chosen before signing in', () => {
  it('is saved when it differs from the account', () => {
    expect(languageToSave('tr', 'en')).toBe('tr')
    expect(languageToSave('en', 'tr')).toBe('en')
  })

  it('leaves the account alone when the person did not touch the switch', () => {
    expect(languageToSave(null, 'tr')).toBeNull()
    expect(languageToSave(null, 'en')).toBeNull()
  })

  it('does not save what the account already has', () => {
    expect(languageToSave('tr', 'tr')).toBeNull()
  })
})
