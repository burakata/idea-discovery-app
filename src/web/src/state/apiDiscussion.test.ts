import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { toMessage, toMessagePage } from '../api/room'
import en from '../strings/en'
import tr from '../strings/tr'
import { createApiSession } from './apiSession'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const row = {
  id: 'm1',
  authorId: 'u1',
  authorName: 'Ayla',
  authorRole: 'owner',
  authorLeft: false,
  text: 'Hello',
  language: 'tr',
  translation: null,
  createdAt: '2026-11-20T10:00:00Z',
}

describe('messages from the API are checked where they come in', () => {
  it('maps a good row as it is', () => {
    expect(toMessage(row)).toEqual({ ...row })
  })

  it('leaves out a row with no id, writer or text', () => {
    expect(toMessage({ ...row, id: '' })).toBeNull()
    expect(toMessage({ ...row, id: undefined })).toBeNull()
    expect(toMessage({ ...row, authorId: 7 })).toBeNull()
    expect(toMessage({ ...row, text: null })).toBeNull()
    expect(toMessage(null)).toBeNull()
    expect(toMessagePage({ messages: [row, { text: 'no id' }, 'junk'], cursor: '1-1' }).messages).toHaveLength(1)
  })

  it('gives someone who has left no role, whatever the row says', () => {
    expect(toMessage({ ...row, authorLeft: true, authorRole: 'consultant' })).toMatchObject({
      authorLeft: true,
      authorRole: null,
    })
  })

  it('never turns an unknown role into the consultant, and never into the assistant', () => {
    for (const authorRole of ['admin', 'assistant', 7, undefined]) {
      expect(toMessage({ ...row, authorRole })?.authorRole).toBeNull()
    }
    expect(toMessage({ ...row, authorRole: 'consultant' })?.authorRole).toBe('consultant')
  })

  it('reads an unknown language as the default and keeps a translation only when it is text', () => {
    expect(toMessage({ ...row, language: 'de' })?.language).toBe('en')
    expect(toMessage({ ...row, translation: 'Merhaba' })?.translation).toBe('Merhaba')
    expect(toMessage({ ...row, translation: '' })?.translation).toBeNull()
    expect(toMessage({ ...row, translation: { x: 1 } })?.translation).toBeNull()
  })

  it('refuses an answer with no cursor, so the client never re-reads everything blindly', () => {
    expect(() => toMessagePage({ messages: [row] })).toThrow(ApiError)
    expect(() => toMessagePage({ messages: [row], cursor: '' })).toThrow(ApiError)
    expect(() => toMessagePage({ cursor: '1-1' })).toThrow(ApiError)
    expect(() => toMessagePage(null)).toThrow(ApiError)
  })
})

// A fake server for the discussion's calls; every request is logged.
async function signedIn(answer: (url: string, method: string) => Response | undefined) {
  const calls: { url: string; method: string; body: string | null }[] = []
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') return json({ id: 'u1', displayName: 'Ayla', uiLanguage: 'en', isConsultant: true })
    if (url === '/api/projects') return json([])
    calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : null })
    return answer(url, method) ?? json({}, 404)
  }) as typeof fetch
  const session = createApiSession({ fetch: send, storage: { getItem: () => null, setItem: () => {} } })
  await session.start()
  return { session, calls }
}

async function failureOf(run: Promise<unknown>): Promise<ApiError> {
  try {
    await run
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected an ApiError')
}

describe('the discussion against the API', () => {
  it('reads a conversation without a cursor first, then passes the cursor back as `after`', async () => {
    const { session, calls } = await signedIn((url) =>
      url.startsWith('/api/projects/p1/conversations/2/messages') ? json({ messages: [row], cursor: '2-1' }) : undefined,
    )
    const first = await session.readMessages('p1', 2)
    expect(first.cursor).toBe('2-1')
    expect(first.messages).toHaveLength(1)
    await session.readMessages('p1', 2, first.cursor)
    expect(calls.map((call) => call.url)).toEqual([
      '/api/projects/p1/conversations/2/messages',
      '/api/projects/p1/conversations/2/messages?after=2-1',
    ])
  })

  it('posts the text and returns the stored message', async () => {
    const { session, calls } = await signedIn((url, method) =>
      method === 'POST' && url === '/api/projects/p1/conversations/active/messages' ? json(row, 201) : undefined,
    )
    expect(await session.postMessage('p1', 'Hello')).toMatchObject({ id: 'm1', text: 'Hello' })
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ text: 'Hello' })
  })

  it('shows a 409 on a post as its own message, in both languages, so the screen can say it plainly', async () => {
    const { session } = await signedIn(() => json({ error: 'no_active_conversation' }, 409))
    const failure = await failureOf(session.postMessage('p1', 'Hello'))
    expect(failure.status).toBe(409)
    expect(failure.key).toBe('conversationFinished')
    expect(failure.key).not.toBe('generic')
    expect(en.errors[failure.key]).not.toBe(en.errors.generic)
    expect(tr.errors[failure.key]).not.toBe(tr.errors.generic)
  })

  it('tells an empty message, a too long one and a rate limit apart from other failures', async () => {
    const cases: [Response, string][] = [
      [json({ error: 'invalid_request' }, 400), 'messageNotValid'],
      [new Response(null, { status: 413 }), 'messageTooLong'],
      [json({}, 429), 'tooManyTries'],
      [json({}, 500), 'generic'],
    ]
    for (const [answer, key] of cases) {
      const { session } = await signedIn(() => answer.clone())
      expect((await failureOf(session.postMessage('p1', 'Hello'))).key).toBe(key)
    }
  })

  it('lists conversations, finishes the active one and starts the next as Burak', async () => {
    const started = { number: 2, state: 'active', startedAt: '2026-11-20T10:00:00Z', finishedAt: null }
    const { session, calls } = await signedIn((url, method) => {
      if (url === '/api/projects/p1/conversations' && method === 'GET') return json([started])
      if (url === '/api/consultant/projects/p1/conversations/active/finish') return new Response(null, { status: 204 })
      if (url === '/api/consultant/projects/p1/conversations') return json(started, 201)
      return undefined
    })
    expect(await session.listConversations('p1')).toEqual([started])
    await session.finishConversation('p1')
    expect(await session.startConversation('p1')).toEqual(started)
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'GET /api/projects/p1/conversations',
      'POST /api/consultant/projects/p1/conversations/active/finish',
      'POST /api/consultant/projects/p1/conversations',
    ])
  })

  it('says a second start while one is open in its own message', async () => {
    const { session } = await signedIn(() => json({ error: 'conversation_active' }, 409))
    expect((await failureOf(session.startConversation('p1'))).key).toBe('conversationActive')
  })

  it('refuses a start answer that is not a conversation', async () => {
    const { session } = await signedIn(() => json({ number: 'x' }, 201))
    expect((await failureOf(session.startConversation('p1'))).status).toBe(502)
  })

  it('signs the person out after a 401 and sends them to their list after a 404, as for every call', async () => {
    const out = await signedIn(() => json({}, 401))
    await failureOf(out.session.readMessages('p1', 1))
    expect(out.session.getState().status).toBe('signedOut')

    const gone = await signedIn(() => json({}, 404))
    await failureOf(gone.session.readMessages('p1', 1))
    expect(gone.session.getState().notice).toBe('projectGone')
  })
})
