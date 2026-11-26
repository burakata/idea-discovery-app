import { describe, expect, it } from 'vitest'
import en from '../strings/en'
import tr from '../strings/tr'
import { consultant } from '../strings/consultant'
import { ApiError, createApiClient } from './client'
import { createJoinApi, joinErrorKey, toCanAsk, toJoinRequest, toJoinState } from './join'

interface Call {
  method: string
  url: string
  body?: string
}

// A fake server: every call is kept; answers come from the function.
function setup(answer: (method: string, url: string) => Response) {
  const calls: Call[] = []
  const statusEffects: string[] = []
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    calls.push({ method, url, body: init?.body as string | undefined })
    return answer(method, url)
  }) as typeof fetch
  const api = createApiClient({ fetch: send, onStatus: (effect) => statusEffects.push(effect) })
  return { join: createJoinApi(api), calls, statusEffects }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('the join api: the person asking', () => {
  it('reads whether asking is open, and only an explicit true opens the form', async () => {
    const { join, calls } = setup(() => json({ canAsk: true }))
    expect(await join.canAsk('abc')).toBe(true)
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/join/abc' })
    expect(toCanAsk({ canAsk: false })).toBe(false)
    expect(toCanAsk({ canAsk: 'yes' })).toBe(false)
    expect(toCanAsk({})).toBe(false)
    expect(toCanAsk(undefined)).toBe(false)
  })

  it('encodes the code in the address', async () => {
    const { join, calls } = setup(() => json({ canAsk: false }))
    await join.canAsk('a/b?c')
    expect(calls[0].url).toBe('/api/join/a%2Fb%3Fc')
  })

  it('asks with the name, and sends no email at all when none was given', async () => {
    const { join, calls } = setup(() => json({ state: 'pending' }, 202))
    await join.ask('abc', { name: 'Işıl', email: '  ' })
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/join/abc' })
    expect(JSON.parse(calls[0].body!)).toEqual({ name: 'Işıl', email: null })
    await join.ask('abc', { name: 'Işıl', email: ' i@example.test ' })
    expect(JSON.parse(calls[1].body!)).toEqual({ name: 'Işıl', email: 'i@example.test' })
  })

  it('reads the state of the browser\'s own request; anything unknown is expired', async () => {
    const { join, calls } = setup(() => json({ state: 'approved' }))
    expect(await join.status()).toBe('approved')
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/join/request' })
    for (const state of ['pending', 'approved', 'rejected', 'expired']) expect(toJoinState({ state })).toBe(state)
    expect(toJoinState({ state: 'claimed' })).toBe('expired')
    expect(toJoinState({})).toBe('expired')
  })

  it('claims once approved', async () => {
    const { join, calls } = setup(() => json({ id: 'u', displayName: 'Işıl', uiLanguage: 'en', isConsultant: false }))
    const me = await join.claim<{ id: string }>()
    expect(me.id).toBe('u')
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/join/claim' })
  })

  it('never sends a signed-out visitor to the list, whatever the answer', async () => {
    const { join, statusEffects } = setup(() => json({ error: 'cannot_ask' }, 404))
    await expect(join.ask('abc', { name: 'A', email: '' })).rejects.toBeInstanceOf(ApiError)
    expect(statusEffects).toEqual([])
  })

  it('treats an unknown code and a switched-off project alike', async () => {
    // The API answers both with the same body; the client has nothing to tell them apart by.
    const unknown = setup(() => json({ canAsk: false }))
    const off = setup(() => json({ canAsk: false }))
    expect(await unknown.join.canAsk('nope')).toBe(await off.join.canAsk('off'))
  })
})

describe('the join api: error codes for the person asking', () => {
  const key = (status: number, error: string | null) =>
    new ApiError(status, error).key

  it('maps each refusal to its own text, in both languages', () => {
    expect(joinErrorKey(new ApiError(400, 'invalid_request'))).toBe('nameNotValid')
    expect(joinErrorKey(new Error('x'))).toBe('generic')
    expect(key(429, 'try_later')).toBe('joinTryLater')
    expect(key(404, 'cannot_ask')).toBe('joinClosed')
    expect(key(400, 'cannot_claim')).toBe('cannotClaim')
    expect(key(429, null)).toBe('tooManyTries')
    expect(key(0, null)).toBe('network')
    for (const k of ['nameNotValid', 'joinTryLater', 'joinClosed', 'cannotClaim'] as const) {
      expect(en.errors[k].length).toBeGreaterThan(0)
      expect(tr.errors[k].length).toBeGreaterThan(0)
    }
  })

  it('says plainly that the link is not open, and what to do', () => {
    expect(en.errors.joinClosed).toBe('This link isn’t open for requests. Ask your consultant for an invitation.')
    expect(en.errors.cannotClaim).toBe('This request can no longer be used. Ask your consultant.')
  })
})

describe('the join api: Burak', () => {
  it('turns asking on, off and replaces the link; the link is the server\'s', async () => {
    const { join, calls } = setup((_method, url) =>
      url.endsWith('/off') ? new Response(null, { status: 204 }) : json({ link: 'https://app.test/join/CODE' }),
    )
    expect(await join.turnOn('p1')).toBe('https://app.test/join/CODE')
    await join.turnOff('p1')
    expect(await join.renew('p1')).toBe('https://app.test/join/CODE')
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/consultant/projects/p1/join-link',
      'POST /api/consultant/projects/p1/join-link/off',
      'POST /api/consultant/projects/p1/join-link/renew',
    ])
  })

  it('lists waiting requests, flagging a name only when the server did', async () => {
    const { join, calls } = setup(() =>
      json([
        { id: 'r1', name: 'Işıl', uncheckedEmail: 'i@example.test', device: 'UA', createdAt: 'c', expiresAt: 'e', nameMatchesMember: true },
        { id: 'r2', name: 'Can', uncheckedEmail: null, createdAt: 'c', expiresAt: 'e' },
      ]),
    )
    const list = await join.listRequests('p1')
    expect(calls[0].url).toBe('/api/consultant/projects/p1/join-requests')
    expect(list.map((request) => request.nameMatchesMember)).toEqual([true, false])
    expect(list[1]).toMatchObject({ uncheckedEmail: null, device: null })
    expect(toJoinRequest({ id: 'x', nameMatchesMember: 'true' }).nameMatchesMember).toBe(false)
  })

  it('approves with the corrected name only when one is given, and rejects', async () => {
    const { join, calls } = setup((_method, url) =>
      url.endsWith('/reject') ? new Response(null, { status: 204 }) : json({ userId: 'u', displayName: 'Işıl Y.' }),
    )
    expect(await join.approve('r1', 'Işıl Y.')).toBe('Işıl Y.')
    expect(JSON.parse(calls[0].body!)).toEqual({ displayName: 'Işıl Y.' })
    await join.approve('r1')
    expect(JSON.parse(calls[1].body!)).toEqual({})
    await join.reject('r1')
    expect(calls.map((call) => call.url)).toEqual([
      '/api/consultant/join-requests/r1/approve',
      '/api/consultant/join-requests/r1/approve',
      '/api/consultant/join-requests/r1/reject',
    ])
  })

  it('maps the refusals to Burak\'s texts', () => {
    expect(new ApiError(409, 'request_not_waiting').consultantKey).toBe('requestNotWaiting')
    expect(new ApiError(400, 'invalid_request').consultantKey).toBe('invalidRequest')
    expect(consultant.errors.requestNotWaiting).toContain('already answered')
  })
})
