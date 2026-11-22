import { describe, expect, it } from 'vitest'
import { createApiSession } from './apiSession'
import type { Clipboard } from './copyLink'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const LINK = 'https://app.test/sign-in#t=SECRET-TOKEN-123'

function setup(clipboard: Clipboard | undefined) {
  const calls: string[] = []
  let projectList = [{ id: 'p1', titleEn: 'One', titleTr: 'Bir' }]
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push(`${method} ${url}`)
    if (url === '/api/auth/csrf') return json({ token: 'T' })
    if (url === '/api/auth/me') return json({ id: 'b', displayName: 'Burak', uiLanguage: 'en', isConsultant: true })
    if (url === '/api/projects') return json(projectList)
    if (url === '/api/consultant/projects' && method === 'POST') {
      projectList = [...projectList, { id: 'p2', titleEn: 'Two', titleTr: 'İki' }]
      return json({ id: 'p2', titleEn: 'Two', titleTr: 'İki', introEn: 'a', introTr: 'b', members: [] }, 201)
    }
    if (url === '/api/consultant/users/u2/sign-in-link') return json({ link: LINK })
    if (url === '/api/consultant/invitations/i1/link') return json({ link: LINK })
    if (url.endsWith('/remove') || url.endsWith('/revoke')) return new Response(null, { status: 204 })
    return json({}, 404)
  }) as typeof fetch
  const session = createApiSession({ fetch: send, storage: { getItem: () => null, setItem: () => {} }, clipboard })
  return { session, calls }
}

const draft = { title: { en: 'Two', tr: 'İki' }, intro: { en: 'a', tr: 'b' } }

describe('the api store: creating a project', () => {
  it('creates it, then reloads the list so the new project shows', async () => {
    const { session, calls } = setup(undefined)
    await session.start()
    expect(session.getState().projects?.map((card) => card.id)).toEqual(['p1'])

    const id = await session.createProject(draft)

    expect(id).toBe('p2')
    expect(calls.filter((call) => call === 'GET /api/projects')).toHaveLength(2)
    expect(session.getState().projects?.map((card) => card.id)).toEqual(['p1', 'p2'])
    expect(session.getState().projects?.[1].title).toEqual({ en: 'Two', tr: 'İki' })
  })

  it('throws the refusal for the screen to show', async () => {
    const { session } = setup(undefined)
    await session.start()
    // The fake server has no answer for this route: 404.
    await expect(session.getProject('p9')).rejects.toMatchObject({ status: 404 })
  })
})

describe('the api store: copying a link', () => {
  it('puts the link on the clipboard and keeps it nowhere else', async () => {
    const copied: string[] = []
    const { session } = setup({ writeText: async (text) => void copied.push(text) })
    await session.start()

    const result = await session.copySignInLink('u2')
    const invitation = await session.copyInvitationLink('i1')

    expect(result).toEqual({ copied: true })
    expect(invitation).toEqual({ copied: true })
    expect(copied).toEqual([LINK, LINK])
    // Not in what the store holds, and not in anything it returned.
    expect(JSON.stringify(session.getState())).not.toContain('SECRET-TOKEN')
    expect(JSON.stringify([result, invitation])).not.toContain('SECRET-TOKEN')
  })

  it('hands the link back once when the clipboard refuses, and still keeps none', async () => {
    const { session } = setup({
      writeText: async () => {
        throw new Error('denied')
      },
    })
    await session.start()
    const result = await session.copySignInLink('u2')
    expect(result).toEqual({ copied: false, link: LINK })
    expect(JSON.stringify(session.getState())).not.toContain('SECRET-TOKEN')
  })

  it('hands the link back when there is no clipboard at all', async () => {
    const { session } = setup(undefined)
    await session.start()
    // In the test there is no navigator.clipboard either.
    expect(await session.copyInvitationLink('i1')).toEqual({ copied: false, link: LINK })
  })
})
