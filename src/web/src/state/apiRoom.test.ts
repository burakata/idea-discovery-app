import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { createApiSession } from './apiSession'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const project = { id: 'p1', titleEn: 'Title', titleTr: 'Başlık', introEn: 'Intro', introTr: 'Giriş', members: [] }

// A fake server: the person is signed in and the room's two calls answer as told.
async function signedIn(answers: { project: Response; conversations: Response }) {
  const send = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') return json({ id: 'u1', displayName: 'Ayla', uiLanguage: 'en', isConsultant: false })
    if (url === '/api/projects') return json([])
    if (url === '/api/projects/p1') return answers.project
    if (url === '/api/projects/p1/conversations') return answers.conversations
    return json({}, 404)
  }) as typeof fetch
  const session = createApiSession({ fetch: send, storage: { getItem: () => null, setItem: () => {} } })
  await session.start()
  return session
}

async function failureOf(run: Promise<unknown>): Promise<unknown> {
  try {
    await run
  } catch (failure) {
    return failure
  }
  throw new Error('expected a refusal')
}

describe('loading a room from the API', () => {
  it('rejects a project that is gone or not the person’s, and says so with the "project gone" notice', async () => {
    const session = await signedIn({ project: json({}, 404), conversations: json({}, 404) })
    const failure = await failureOf(session.loadRoom('p1'))
    expect(failure).toBeInstanceOf(ApiError)
    expect((failure as ApiError).status).toBe(404)
    expect(session.getState().notice).toBe('projectGone')
    // Still signed in: only the room is gone.
    expect(session.getState().status).toBe('signedIn')
  })

  it('signs the person out after a 401', async () => {
    const session = await signedIn({ project: json({}, 401), conversations: json({}, 401) })
    const failure = await failureOf(session.loadRoom('p1'))
    expect((failure as ApiError).status).toBe(401)
    expect(session.getState().status).toBe('signedOut')
    expect(session.getState().me).toBeNull()
    expect(session.getState().notice).toBe('signedOut')
  })

  it('gives the project’s own texts and leaves out members’ emails', async () => {
    const withEmail = { ...project, members: [{ userId: 'u1', displayName: 'Ayla', role: 'owner', email: 'a@example.test' }] }
    const session = await signedIn({ project: json(withEmail), conversations: json([]) })
    const room = await session.loadRoom('p1')
    expect(room.title).toEqual({ en: 'Title', tr: 'Başlık' })
    expect(room.members).toEqual([{ userId: 'u1', displayName: 'Ayla', role: 'owner' }])
    expect(JSON.stringify(room)).not.toContain('a@example.test')
  })

  it('checks the conversations: unusable rows are left out and an unknown state is not active', async () => {
    const rows = [
      { number: 3, state: 'paused', startedAt: '2026-11-20T10:00:00Z', finishedAt: null },
      { number: 'two', state: 'active' },
      null,
      { number: 1, state: 'finished', startedAt: '2026-11-10T10:00:00Z', finishedAt: '2026-11-19T10:00:00Z' },
    ]
    const session = await signedIn({ project: json(project), conversations: json(rows) })
    const room = await session.loadRoom('p1')
    expect(room.conversations.map((entry) => [entry.number, entry.state])).toEqual([
      [3, 'finished'],
      [1, 'finished'],
    ])
  })
})
