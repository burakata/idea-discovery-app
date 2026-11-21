import { describe, expect, it } from 'vitest'
import { createApiSession } from './apiSession'

type Handler = (url: string, method: string) => Response | Error

// A fake server: every call goes to the handler, which answers by method and path.
function session(handler: Handler, extra: { storage?: Record<string, string>; languages?: string[] } = {}) {
  const calls: string[] = []
  const store = extra.storage ?? {}
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${String(input)}`)
    if (String(input) === '/api/auth/csrf') return json({ token: 'T' })
    const answer = handler(String(input), method)
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  const created = createApiSession({
    fetch: send,
    storage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => void (store[key] = value) },
    browserLanguages: extra.languages,
  })
  return { ...created, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const empty = (status: number) => new Response(null, { status })
const owner = { id: 'u1', displayName: 'Elif Yıldız', uiLanguage: 'tr', isConsultant: false }

describe('a 401 on the project list', () => {
  it('signs the person out and keeps the "signed out" notice', async () => {
    const s = session((url) => (url === '/api/auth/me' ? json(owner) : json({}, 401)))
    await s.start()
    const state = s.getState()
    expect(state.status).toBe('signedOut')
    expect(state.me).toBeNull()
    expect(state.projects).toBeNull()
    expect(state.notice).toBe('signedOut')
  })

  it('survives other changes, such as the visitor switching language', async () => {
    const s = session((url) => (url === '/api/auth/me' ? json(owner) : json({}, 401)))
    await s.start()
    expect(s.getState().notice).toBe('signedOut')
    s.setLanguage('en')
    expect(s.getState().notice).toBe('signedOut')
  })

  it('is cleared by the sign-in itself, before any project reload could clear it', async () => {
    let listAnswers: Response = json({}, 401)
    const s = session((url) => {
      if (url === '/api/auth/me' || url === '/api/auth/redeem') return json(owner)
      return listAnswers
    })
    await s.start()
    expect(s.getState().status).toBe('signedOut')
    expect(s.getState().notice).toBe('signedOut')

    // The first change redeem announces must already have the notice gone.
    const seen: Array<string | null> = []
    s.subscribe(() => seen.push(s.getState().notice))
    listAnswers = json([])
    await s.redeem('a-token', null)
    expect(seen[0]).toBeNull()
    expect(s.getState().status).toBe('signedIn')
  })
})

describe('a project list that fails to load', () => {
  it('reports the error and does not pretend the list is empty', async () => {
    const s = session((url) => (url === '/api/auth/me' ? json(owner) : json({}, 500)))
    await s.start()
    const state = s.getState()
    expect(state.status).toBe('signedIn')
    expect(state.projects).toBeNull()
    expect(state.projectsError).toBe('generic')
  })

  it('reports a lost connection as the network error', async () => {
    const s = session((url) => (url === '/api/auth/me' ? json(owner) : new TypeError('offline')))
    await s.start()
    expect(s.getState().projectsError).toBe('network')
  })

  it('shows the projects when they load', async () => {
    const s = session((url) =>
      url === '/api/auth/me' ? json(owner) : json([{ id: 'p1', titleEn: 'Shop', titleTr: 'Dükkan' }]),
    )
    await s.start()
    expect(s.getState().projects).toEqual([{ id: 'p1', title: { en: 'Shop', tr: 'Dükkan' } }])
    expect(s.getState().projectsError).toBeNull()
  })
})

describe('signing out', () => {
  const signedIn = (signOut: () => Response | Error) =>
    session((url) => {
      if (url === '/api/auth/me') return json(owner)
      if (url === '/api/auth/sign-out') return signOut()
      return json([])
    })

  it('clears the session when the server answers 204, and says the person signed out', async () => {
    const s = signedIn(() => empty(204))
    await s.start()
    await s.signOut()
    expect(s.getState().status).toBe('signedOut')
    expect(s.getState().notice).toBe('signedOutByYou')
  })

  it('clears the session when the server says nobody is signed in (401)', async () => {
    const s = signedIn(() => json({}, 401))
    await s.start()
    await s.signOut()
    expect(s.getState().status).toBe('signedOut')
    expect(s.getState().notice).toBe('signedOutByYou')
  })

  it('stays signed in and shows the error when the server fails', async () => {
    const s = signedIn(() => json({}, 500))
    await s.start()
    await s.signOut()
    expect(s.getState().status).toBe('signedIn')
    expect(s.getState().me).not.toBeNull()
    expect(s.getState().actionError).toBe('generic')
  })

  it('stays signed in and shows the network error when there is no connection', async () => {
    const s = signedIn(() => new TypeError('offline'))
    await s.start()
    await s.signOut()
    expect(s.getState().status).toBe('signedIn')
    expect(s.getState().actionError).toBe('network')
  })
})

describe('the language before sign-in', () => {
  const nobody: Handler = () => json({}, 401)

  it('uses a supported browser language when nothing is saved', () => {
    expect(session(nobody, { languages: ['tr-TR', 'en'] }).getState().guestLanguage).toBe('tr')
  })

  it('falls back to English when the browser language is not supported', () => {
    expect(session(nobody, { languages: ['de-DE', 'fr'] }).getState().guestLanguage).toBe('en')
    expect(session(nobody, { languages: [] }).getState().guestLanguage).toBe('en')
  })

  it('prefers what the visitor chose earlier', () => {
    const saved = { 'idea-discovery-rooms-language': 'en' }
    expect(session(nobody, { storage: saved, languages: ['tr'] }).getState().guestLanguage).toBe('en')
  })

  it('saves a language chosen on the sign-in page to the account, and leaves it alone otherwise', async () => {
    const chosen = session((url) => (url === '/api/auth/redeem' ? json(owner) : json([])), {
      languages: ['en'],
    })
    await chosen.redeem('t', 'en')
    expect(chosen.calls).toContain('PUT /api/me/language')
    expect(chosen.getState().me?.uiLanguage).toBe('en')

    const untouched = session((url) => (url === '/api/auth/redeem' ? json(owner) : json([])), {
      languages: ['en'],
    })
    await untouched.redeem('t', null)
    expect(untouched.calls).not.toContain('PUT /api/me/language')
    expect(untouched.getState().me?.uiLanguage).toBe('tr')
  })
})
