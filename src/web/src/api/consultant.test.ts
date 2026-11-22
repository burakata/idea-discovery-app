import { describe, expect, it } from 'vitest'
import { LANGS } from '../languages'
import { consultant as c } from '../strings/consultant'
import { ApiError, consultantErrorKey, createApiClient } from './client'
import { apiField, bilingualFrom, createConsultantApi, toApiProject, toInvitation } from './consultant'

interface Call {
  method: string
  url: string
  body?: unknown
}

// A fake server: answers are taken in order; the CSRF call is answered by itself.
function setup(answers: Array<Response | Error>) {
  const calls: Call[] = []
  const send = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === '/api/auth/csrf') return json({ token: 'T' })
    calls.push({
      method: init?.method ?? 'GET',
      url: String(input),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    const answer = answers.shift()
    if (!answer) throw new Error('no answer left')
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  const effects: string[] = []
  const api = createApiClient({ fetch: send, onStatus: (effect) => effects.push(effect) })
  return { consultant: createConsultantApi(api), calls, effects }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const empty = (status = 204) => new Response(null, { status })

const draft = {
  title: { en: 'Meals', tr: 'Yemekler' },
  intro: { en: 'About meals', tr: 'Yemekler hakkında' },
}
const apiProject = {
  id: 'p1',
  titleEn: 'Meals',
  titleTr: 'Yemekler',
  introEn: 'About meals',
  introTr: 'Yemekler hakkında',
  members: [
    { userId: 'u1', displayName: 'Burak', role: 'consultant', email: 'b@x.test' },
    { userId: 'u2', displayName: 'Elif', role: 'owner', email: 'e@x.test' },
  ],
}

describe('the project shape', () => {
  it('names a field by its language, for every language in languages.ts', () => {
    expect(apiField('title', 'en')).toBe('titleEn')
    expect(apiField('intro', 'tr')).toBe('introTr')
    const body = toApiProject(draft)
    for (const lang of LANGS) {
      expect(body[apiField('title', lang)]).toBe(draft.title[lang])
      expect(body[apiField('intro', lang)]).toBe(draft.intro[lang])
    }
    expect(Object.keys(body)).toHaveLength(LANGS.length * 2)
  })

  it('reads the API titles into one lookup by language', () => {
    expect(bilingualFrom(apiProject, 'title')).toEqual({ en: 'Meals', tr: 'Yemekler' })
    expect(bilingualFrom({}, 'title')).toEqual({ en: '', tr: '' })
  })

  it('shows an invitation state it does not know as not open', () => {
    expect(toInvitation({ id: 'i', state: 'something-new', language: 'xx' })).toMatchObject({
      state: 'expired',
      language: 'en',
    })
  })
})

describe('creating and editing a project', () => {
  it('posts the API shape to /consultant/projects and returns the project', async () => {
    const { consultant, calls } = setup([json(apiProject, 201)])
    const project = await consultant.createProject(draft)
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/api/consultant/projects',
      body: { titleEn: 'Meals', titleTr: 'Yemekler', introEn: 'About meals', introTr: 'Yemekler hakkında' },
    })
    expect(project.id).toBe('p1')
    expect(project.title).toEqual(draft.title)
  })

  it('puts the same shape to the project', async () => {
    const { consultant, calls } = setup([json(apiProject)])
    await consultant.saveProject('p1', draft)
    expect(calls[0].method).toBe('PUT')
    expect(calls[0].url).toBe('/api/consultant/projects/p1')
    expect(calls[0].body).toMatchObject({ titleTr: 'Yemekler' })
  })

  it('reads a project with its members and emails', async () => {
    const { consultant, calls } = setup([json(apiProject)])
    const project = await consultant.getProject('p1')
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/projects/p1' })
    expect(project.intro).toEqual(draft.intro)
    expect(project.members.map((member) => [member.displayName, member.role, member.email])).toEqual([
      ['Burak', 'consultant', 'b@x.test'],
      ['Elif', 'owner', 'e@x.test'],
    ])
  })

  it('has no email on a member the API gave none for', async () => {
    const { consultant } = setup([json({ ...apiProject, members: [{ userId: 'u', displayName: 'A', role: 'owner' }] })])
    expect((await consultant.getProject('p1')).members[0].email).toBeNull()
  })

  it('tells the store about a 404 on the project, so Burak goes back to his list', async () => {
    const { consultant, effects } = setup([json({}, 404)])
    await expect(consultant.getProject('gone')).rejects.toMatchObject({ status: 404 })
    expect(effects).toEqual(['toList'])
  })
})

describe('inviting', () => {
  const input = { email: 'a@x.test', displayName: 'Ayşe', language: 'tr' as const }

  it('posts email, name and language, and reads "invited"', async () => {
    const { consultant, calls } = setup([json({ kind: 'invited', invitationId: 'i1' }, 201)])
    expect(await consultant.invite('p1', input)).toEqual({ kind: 'invited' })
    expect(calls[0]).toEqual({
      method: 'POST',
      url: '/api/consultant/projects/p1/invitations',
      body: { email: 'a@x.test', displayName: 'Ayşe', language: 'tr' },
    })
  })

  it('reads "added" with the account name, not the typed one', async () => {
    const { consultant } = setup([json({ kind: 'added', userId: 'u', displayName: 'Ayşe Demir' }, 201)])
    expect(await consultant.invite('p1', input)).toEqual({ kind: 'added', displayName: 'Ayşe Demir' })
  })

  it('reads a 429 "try_later" as an outcome, not a fault', async () => {
    const { consultant } = setup([json({ error: 'try_later' }, 429)])
    expect(await consultant.invite('p1', input)).toEqual({ kind: 'tryLater' })
  })

  it('throws the other refusals, with their keys', async () => {
    for (const [code, key] of [
      ['already_member', 'alreadyMember'],
      ['already_invited', 'alreadyInvited'],
      ['cannot_invite_consultant', 'ownEmail'],
      ['invalid_request', 'invalidRequest'],
    ] as const) {
      const { consultant } = setup([json({ error: code }, code === 'invalid_request' ? 400 : 409)])
      const failure = await consultant.invite('p1', input).catch((error: ApiError) => error)
      expect(failure).toBeInstanceOf(ApiError)
      expect((failure as ApiError).consultantKey).toBe(key)
    }
  })
})

describe('invitations, sessions and links', () => {
  it('lists the invitations of a project', async () => {
    const { consultant, calls } = setup([
      json([
        { id: 'i1', email: 'a@x.test', displayName: 'A', language: 'tr', state: 'open', createdAt: 'c', expiresAt: 'e' },
      ]),
    ])
    const [invitation] = await consultant.listInvitations('p1')
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/consultant/projects/p1/invitations' })
    expect(invitation).toMatchObject({ id: 'i1', state: 'open', language: 'tr' })
  })

  it('revokes an invitation', async () => {
    const { consultant, calls } = setup([empty()])
    await consultant.revokeInvitation('i1')
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/consultant/invitations/i1/revoke' })
  })

  it('does not send Burak to his list for a missing invitation, session or person', async () => {
    const { consultant, effects } = setup([json({}, 404), json({}, 404), json({}, 404), json({}, 404)])
    await consultant.revokeInvitation('i').catch(() => {})
    await consultant.endSession('s').catch(() => {})
    await consultant.signInLink('u').catch(() => {})
    await consultant.listSessions('u').catch(() => {})
    expect(effects).toEqual([])
  })

  it('asks for the links the API hands out', async () => {
    const { consultant, calls } = setup([
      json({ link: 'https://x/sign-in#t=1' }),
      json({ link: 'https://x/sign-in#t=2' }),
    ])
    expect(await consultant.signInLink('u1')).toBe('https://x/sign-in#t=1')
    expect(await consultant.invitationLink('i1')).toBe('https://x/sign-in#t=2')
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/consultant/users/u1/sign-in-link',
      'POST /api/consultant/invitations/i1/link',
    ])
  })

  it('lists the sessions of a person, without the IP address', async () => {
    const { consultant, calls } = setup([
      json([
        { id: 's1', createdAt: 'a', lastSeenAt: 'b', expiresAt: 'c', endedAt: null, device: 'Chrome', ipAddress: '1.2.3.4' },
      ]),
    ])
    const [session] = await consultant.listSessions('u1')
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/consultant/users/u1/sessions' })
    expect(session).toEqual({ id: 's1', createdAt: 'a', lastSeenAt: 'b', expiresAt: 'c', endedAt: null, device: 'Chrome' })
  })

  it('ends a session and removes a member', async () => {
    const { consultant, calls } = setup([empty(), empty()])
    await consultant.endSession('s1')
    await consultant.removeMember('p1', 'u2')
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/consultant/sessions/s1/revoke',
      'POST /api/consultant/projects/p1/members/u2/remove',
    ])
  })
})

describe('error codes on the consultant screens', () => {
  it('maps each API code to a key that has text', () => {
    const cases: Array<[number, string | null, string]> = [
      [400, 'invalid_request', 'invalidRequest'],
      [409, 'already_member', 'alreadyMember'],
      [409, 'already_invited', 'alreadyInvited'],
      [409, 'cannot_invite_consultant', 'ownEmail'],
      [409, 'invitation_not_open', 'invitationNotOpen'],
      [409, 'cannot_remove_consultant', 'cannotRemoveConsultant'],
      [429, 'try_later', 'tryLater'],
      [429, null, 'tooManyTries'],
      [404, null, 'notFound'],
      [0, null, 'network'],
      [500, 'something_new', 'generic'],
    ]
    for (const [status, code, key] of cases) {
      expect(consultantErrorKey(status, code)).toBe(key)
      expect(c.errors[key as keyof typeof c.errors]).toBeTruthy()
    }
  })
})
