import { describe, expect, it } from 'vitest'
import { createApiSession } from './apiSession'
import type { Clipboard } from './copyLink'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const LINK = 'https://app.test/join/SECRET-CODE-123'

function setup(options: { clipboard?: Clipboard; requestState?: () => string; claimStatus?: number } = {}) {
  const calls: string[] = []
  const saved: Record<string, string> = {}
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') return json({}, 401)
    if (url === '/api/join/request' || url === '/api/join/request?code=abc') return json({ state: options.requestState?.() ?? 'pending' })
    if (url.startsWith('/api/join/request?code=')) {
      const mine = url.endsWith('=abc')
      return json({ state: mine ? (options.requestState?.() ?? 'pending') : 'expired', forThisLink: mine })
    }
    if (url === '/api/projects/p1') {
      return json({ id: 'p1', titleEn: 'One', titleTr: 'Bir', introEn: 'a', introTr: 'b', members: [], askToJoin: { enabled: true, link: LINK } })
    }
    if (url === '/api/join/abc' && method === 'GET') return json({ canAsk: true })
    if (url === '/api/join/abc' && method === 'POST') return json({ state: 'pending' }, 202)
    if (url.startsWith('/api/join/') && method === 'GET' && url !== '/api/join/abc') return json({ canAsk: false })
    if (url === '/api/join/claim') {
      return options.claimStatus
        ? json({ error: 'cannot_claim' }, options.claimStatus)
        : json({ id: 'u1', displayName: 'Işıl', uiLanguage: 'en', isConsultant: false })
    }
    if (url === '/api/me/language') return new Response(null, { status: 204 })
    if (url === '/api/projects') return json([{ id: 'p1', titleEn: 'One', titleTr: 'Bir' }])
    if (url.endsWith('/join-link') || url.endsWith('/renew')) return json({ link: LINK })
    if (url.endsWith('/join-requests')) return json([])
    return json({}, 404)
  }) as typeof fetch
  const session = createApiSession({
    fetch: send,
    storage: { getItem: (key) => saved[key] ?? null, setItem: (key, value) => void (saved[key] = value) },
    clipboard: options.clipboard,
  })
  return { session, calls, saved }
}

describe('the api store: the person asking, signed out', () => {
  it('works with nobody signed in and keeps nothing about the request', async () => {
    const { session, saved } = setup()
    await session.start()
    expect(session.getState().status).toBe('signedOut')
    expect(await session.joinCanAsk('abc')).toBe(true)
    expect(await session.joinAsk('abc', { name: 'Işıl', email: '' })).toBe('pending')
    expect(await session.joinStatus()).toBe('pending')
    // Only the language choice may be remembered; the request is on the page and in the cookie only.
    expect(JSON.stringify(session.getState())).not.toContain('Işıl')
    expect(Object.keys(saved)).not.toContain('join')
    expect(JSON.stringify(saved)).not.toContain('Işıl')
  })

  it('says waiting if the status call fails right after the ask went through', async () => {
    const { session } = setup({
      requestState: () => {
        throw new Error('down')
      },
    })
    await session.start()
    expect(await session.joinAsk('abc', { name: 'Işıl', email: '' })).toBe('pending')
  })

  it('answers an unknown and a switched-off link the same', async () => {
    const { session } = setup()
    await session.start()
    expect(await session.joinCanAsk('closed')).toBe(false)
    expect(await session.joinCanAsk('who-knows')).toBe(false)
  })

  it('continues: signs in as the new person, in the language chosen on the page, and loads the list', async () => {
    const { session, calls } = setup()
    await session.start()
    session.setLanguage('tr')
    await session.joinContinue()
    const state = session.getState()
    expect(state.status).toBe('signedIn')
    expect(state.me).toMatchObject({ id: 'u1', uiLanguage: 'tr', isConsultant: false })
    expect(calls).toContain('PUT /api/me/language')
    expect(calls.filter((call) => call === 'GET /api/projects')).toHaveLength(1)
  })

  it('stays signed out and throws when the claim is refused', async () => {
    const { session } = setup({ claimStatus: 400 })
    await session.start()
    await expect(session.joinContinue()).rejects.toMatchObject({ status: 400, code: 'cannot_claim', key: 'cannotClaim' })
    expect(session.getState().status).toBe('signedOut')
  })
})

describe('the api store: Burak\'s asking to join', () => {
  it('reads whether asking is on from the project, and keeps the link out of state', async () => {
    const { session } = setup()
    await session.start()
    expect(await session.joinAsking('p1')).toBe(true)
    expect(JSON.stringify(session.getState())).not.toContain('SECRET-CODE')
  })

  it('shows a request only on the link it was made on', async () => {
    const { session, calls } = setup()
    expect(await session.joinStatus('abc')).toBe('pending')
    expect(await session.joinStatus('other')).toBe('none')
    expect(calls).toContain('GET /api/join/request?code=other')
  })

  it('copies the link to the clipboard and keeps it out of state', async () => {
    const written: string[] = []
    const { session, saved } = setup({ clipboard: { writeText: async (text) => void written.push(text) } })
    await session.start()
    expect(await session.turnOnJoinLink('p1')).toEqual({ copied: true })
    expect(await session.renewJoinLink('p1')).toEqual({ copied: true })
    expect(written).toEqual([LINK, LINK])
    expect(JSON.stringify(session.getState())).not.toContain('SECRET-CODE')
    expect(JSON.stringify(saved)).not.toContain('SECRET-CODE')
  })

  it('returns the link once, and only, when the clipboard refuses', async () => {
    const { session } = setup({
      clipboard: {
        writeText: async () => {
          throw new Error('refused')
        },
      },
    })
    expect(await session.turnOnJoinLink('p1')).toEqual({ copied: false, link: LINK })
    expect(JSON.stringify(session.getState())).not.toContain('SECRET-CODE')
  })

  it('lists waiting requests', async () => {
    const { session } = setup()
    expect(await session.listJoinRequests('p1')).toEqual([])
  })
})
