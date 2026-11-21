import { describe, expect, it } from 'vitest'
import en from '../strings/en'
import tr from '../strings/tr'
import { ApiError, createApiClient, errorKey, statusEffect, type StatusEffect } from './client'

interface Call {
  method: string
  url: string
  headers: Record<string, string>
  body?: string
  credentials?: RequestCredentials
}

// A fake server: answers are taken from the list in order, and every call is kept.
function fakeFetch(answers: Array<Response | Error>) {
  const calls: Call[] = []
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? 'GET',
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
      credentials: init?.credentials,
    })
    const answer = answers.shift()
    if (!answer) throw new Error('no answer left')
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  return { send, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('statuses', () => {
  it('maps 401 to signed out and 404 to the project list', () => {
    expect(statusEffect(401)).toBe('signedOut')
    expect(statusEffect(404)).toBe('toList')
    for (const status of [200, 204, 400, 403, 409, 429, 500]) expect(statusEffect(status)).toBeNull()
  })

  it('tells the store about a 401 or 404 from any call, before the error', async () => {
    const effects: StatusEffect[] = []
    const { send } = fakeFetch([json({}, 401), json({}, 404)])
    const api = createApiClient({ fetch: send, onStatus: (effect) => effects.push(effect) })

    await expect(api.get('/projects')).rejects.toBeInstanceOf(ApiError)
    await expect(api.get('/projects/abc')).rejects.toMatchObject({ status: 404 })
    expect(effects).toEqual(['signedOut', 'toList'])
  })

  it('does not treat a 401 from the "who am I" call as a sign-out', async () => {
    const effects: StatusEffect[] = []
    const { send } = fakeFetch([json({}, 401)])
    const api = createApiClient({ fetch: send, onStatus: (effect) => effects.push(effect) })

    await expect(api.get('/auth/me', { expectSignedOut: true })).rejects.toMatchObject({ status: 401 })
    expect(effects).toEqual([])
  })
})

describe('error codes', () => {
  it('maps API codes and statuses to keys that exist in both languages', () => {
    expect(errorKey(400, 'link_not_valid')).toBe('linkNotValid')
    expect(errorKey(429, null)).toBe('tooManyTries')
    expect(errorKey(0, null)).toBe('network')
    expect(errorKey(500, 'something_new')).toBe('generic')
    expect(errorKey(400, 'invalid_request')).toBe('generic')
    for (const key of ['linkNotValid', 'tooManyTries', 'network', 'generic'] as const) {
      expect(en.errors[key]).toBeTruthy()
      expect(tr.errors[key]).toBeTruthy()
    }
  })

  it('never carries the API text, only a key', async () => {
    const { send } = fakeFetch([json({ error: 'link_not_valid', detail: 'raw API text' }, 400)])
    const api = createApiClient({ fetch: send })
    const failure = await api.get('/x').catch((error: ApiError) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).key).toBe('linkNotValid')
    expect((failure as ApiError).message).not.toContain('raw API text')
  })

  it('reports a lost connection as status 0', async () => {
    const { send } = fakeFetch([new TypeError('Failed to fetch')])
    const api = createApiClient({ fetch: send })
    await expect(api.get('/projects')).rejects.toMatchObject({ status: 0, key: 'network' })
  })
})

describe('CSRF token', () => {
  it('is not asked for on a GET', async () => {
    const { send, calls } = fakeFetch([json([])])
    await createApiClient({ fetch: send }).get('/projects')
    expect(calls.map((call) => call.url)).toEqual(['/api/projects'])
    expect(calls[0].credentials).toBe('same-origin')
    expect(calls[0].headers['X-CSRF-TOKEN']).toBeUndefined()
  })

  it('is fetched before the first change, sent as X-CSRF-TOKEN, and reused', async () => {
    const { send, calls } = fakeFetch([json({ token: 'T1' }), new Response(null, { status: 202 }), new Response(null, { status: 204 })])
    const api = createApiClient({ fetch: send })

    await api.post('/auth/request-link', { email: 'a@b.c' })
    await api.put('/me/language', { language: 'tr' })

    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET /api/auth/csrf',
      'POST /api/auth/request-link',
      'PUT /api/me/language',
    ])
    expect(calls[1].headers['X-CSRF-TOKEN']).toBe('T1')
    expect(calls[2].headers['X-CSRF-TOKEN']).toBe('T1')
    expect(calls[1].credentials).toBe('same-origin')
    expect(calls[1].body).toBe(JSON.stringify({ email: 'a@b.c' }))
  })

  it('is fetched again after signing in or out', async () => {
    const { send, calls } = fakeFetch([
      json({ token: 'T1' }),
      json({ id: 'u' }),
      json({ token: 'T2' }),
      new Response(null, { status: 204 }),
    ])
    const api = createApiClient({ fetch: send })

    await api.post('/auth/redeem', { token: 'x' })
    api.forgetCsrfToken()
    await api.post('/auth/sign-out')

    expect(calls[3].headers['X-CSRF-TOKEN']).toBe('T2')
  })

  it('is replaced once when the server refuses a stale one', async () => {
    const { send, calls } = fakeFetch([
      json({ token: 'OLD' }),
      json({ error: 'request_refused' }, 403),
      json({ token: 'NEW' }),
      new Response(null, { status: 204 }),
    ])
    await createApiClient({ fetch: send }).post('/auth/sign-out')

    expect(calls.map((call) => call.headers['X-CSRF-TOKEN'] ?? '-')).toEqual(['-', 'OLD', '-', 'NEW'])
  })

  it('does not retry a refusal twice', async () => {
    const { send, calls } = fakeFetch([
      json({ token: 'A' }),
      json({ error: 'request_refused' }, 403),
      json({ token: 'B' }),
      json({ error: 'request_refused' }, 403),
    ])
    await expect(createApiClient({ fetch: send }).post('/auth/sign-out')).rejects.toMatchObject({ status: 403 })
    expect(calls).toHaveLength(4)
  })
})
