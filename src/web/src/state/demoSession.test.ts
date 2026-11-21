import { describe, expect, it } from 'vitest'
import { createInitialState, reducer } from './demoStore'

describe('the demo sign-in', () => {
  it('opens signed out, on the home', () => {
    expect(createInitialState().signedIn).toBe(false)
  })

  it('signs in as Burak, whoever was viewing before', () => {
    const before = { ...createInitialState(), viewAs: 'tom' }
    const after = reducer(before, { type: 'signIn' })
    expect(after.signedIn).toBe(true)
    expect(after.viewAs).toBe('burak')
  })

  it('takes the language chosen on the signed-out pages', () => {
    const after = reducer(createInitialState(), { type: 'signIn', language: 'tr' })
    expect(after.people.burak.language).toBe('tr')
    expect(reducer(createInitialState(), { type: 'signIn' }).people.burak.language).toBe('en')
  })

  it('signs out, and the signed-out home keeps the person\'s language', () => {
    const signedIn = reducer(createInitialState(), { type: 'signIn', language: 'tr' })
    const after = reducer(signedIn, { type: 'signOut' })
    expect(after.signedIn).toBe(false)
    expect(after.guestLanguage).toBe('tr')
  })

  it('remembers the visitor\'s language before signing in', () => {
    const after = reducer(createInitialState(), { type: 'guestLanguage', lang: 'tr' })
    expect(after.guestLanguage).toBe('tr')
    expect(after.signedIn).toBe(false)
  })

  it('returns to the signed-out home when the demo is reset', () => {
    const signedIn = reducer(createInitialState(), { type: 'signIn' })
    expect(reducer(signedIn, { type: 'reset' }).signedIn).toBe(false)
  })
})
