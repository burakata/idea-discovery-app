import { describe, expect, it } from 'vitest'
import { consultant } from '../strings/consultant'
import { emailLine, entryView, joinCopiedMessage, nameWarning, POLL_MS, shouldPoll, viewOf } from './joinRules'

const request = (change: Partial<Parameters<typeof nameWarning>[0]> = {}) => ({
  id: 'r',
  name: 'Işıl',
  uncheckedEmail: null,
  device: null,
  createdAt: '2026-11-24T10:00:00Z',
  expiresAt: '2026-11-26T10:00:00Z',
  nameMatchesMember: false,
  ...change,
})

describe('the waiting page polls only while it should', () => {
  it('polls a waiting request on a visible page', () => {
    expect(shouldPoll('pending', true)).toBe(true)
  })

  it('stops when the page is hidden', () => {
    expect(shouldPoll('pending', false)).toBe(false)
  })

  it('stops once the state is final', () => {
    for (const view of ['approved', 'rejected', 'expired', 'closed', 'form', 'loading'] as const) {
      expect(shouldPoll(view, true)).toBe(false)
    }
  })

  it('asks every 5 to 10 seconds', () => {
    expect(POLL_MS).toBeGreaterThanOrEqual(5000)
    expect(POLL_MS).toBeLessThanOrEqual(10000)
  })
})

describe('what a person sees on opening the link', () => {
  it('shows the form only when asking is open and this browser holds no request', () => {
    expect(entryView('none', true)).toBe('form')
  })

  it('shows the same closed page for an unknown code and a switched-off project', () => {
    // Both reach the client as canAsk false with nothing to tell them apart.
    expect(entryView('none', false)).toBe('closed')
  })

  it('says a request of this browser has run out, instead of showing a blank form', () => {
    expect(entryView('expired', true)).toBe('expired')
    // Asking again re-checks the link: switched off since, it lands on the closed page.
    expect(entryView('none', false)).toBe('closed')
    expect(entryView('none', true)).toBe('form')
  })

  it('shows a request that vanishes while the page is open as run out', () => {
    expect(viewOf('none')).toBe('expired')
    expect(viewOf('pending')).toBe('pending')
  })

  it('shows the browser\'s own request instead of the form', () => {
    expect(entryView('pending', true)).toBe('pending')
    expect(entryView('rejected', true)).toBe('rejected')
    expect(entryView('approved', true)).toBe('approved')
  })

  it('still lets an approval be claimed after asking was switched off', () => {
    expect(entryView('approved', false)).toBe('approved')
    expect(entryView('pending', false)).toBe('pending')
  })
})

describe('Burak\'s waiting list', () => {
  it('shows the same-name warning only when the server flagged it', () => {
    expect(nameWarning(request({ nameMatchesMember: true }))).toBe('Same name as a member')
    expect(nameWarning(request({ nameMatchesMember: false }))).toBeNull()
  })

  it('labels the email as unchecked, and says so when there is none', () => {
    expect(emailLine(request({ uncheckedEmail: 'i@example.test' }))).toBe('i@example.test (unchecked)')
    expect(emailLine(request())).toBe(consultant.people.asking.noEmail)
  })

  it('never puts the link in the message after a copy', () => {
    const message = joinCopiedMessage({ copied: true })
    expect(message).toContain('only lets people ask')
    expect(joinCopiedMessage({ copied: false, link: 'https://x.test/join/SECRET' })).toBeNull()
  })
})
