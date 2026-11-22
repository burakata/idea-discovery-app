import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { projects } from '../projects'
import { createConsultantActions, createInitialState, reducer } from './demoStore'
import * as demo from './demoPeople'
import { copyLink } from './copyLink'
import type { AppState } from './types'

const draft = { title: { en: 'New idea', tr: 'Yeni fikir' }, intro: { en: 'Intro', tr: 'Giriş' } }
const home = projects[0].id
const NOW = new Date('2026-11-22T12:00:00Z')

function refusal(run: () => unknown): ApiError {
  try {
    run()
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected a refusal')
}

describe('the demo: projects', () => {
  it('creates a project with Burak as its only member, and no room', () => {
    const id = demo.newProjectId(createInitialState())
    const state = reducer(createInitialState(), { type: 'createProject', id, draft })
    expect(demo.projectIds(state)).toContain(id)
    expect(demo.textsOf(state, id)).toEqual(draft)
    expect(demo.detailsOf(state, id).members.map((member) => member.displayName)).toEqual(['Burak'])
    expect(state.rooms[id]).toBeUndefined()
  })

  it('edits a sample project without losing its people', () => {
    const before = createInitialState()
    const state = reducer(before, { type: 'saveProject', id: home, draft })
    expect(demo.detailsOf(state, home).title).toEqual(draft.title)
    expect(demo.detailsOf(state, home).members).toEqual(demo.detailsOf(before, home).members)
  })

  it('shows emails for the sample people, Burak first', () => {
    const members = demo.detailsOf(createInitialState(), home).members
    expect(members[0].role).toBe('consultant')
    expect(members.every((member) => member.email?.includes('@'))).toBe(true)
  })

  it('refuses a project that does not exist, like the API', () => {
    expect(refusal(() => demo.detailsOf(createInitialState(), 'nope')).status).toBe(404)
  })

  it('keeps the shape for saved demo data: old data without it is dropped by the version', () => {
    const state: AppState = createInitialState()
    expect(state.version).toBeGreaterThanOrEqual(7)
    expect(Object.keys(state)).toEqual(
      expect.arrayContaining(['created', 'texts', 'members', 'invitations', 'sessions']),
    )
  })
})

describe('the demo: inviting', () => {
  const input = { email: 'new.person@example.test', displayName: 'New Person', language: 'tr' as const }

  it('invites a new address and lists the invitation as open', () => {
    const { outcome, state } = demo.invite(createInitialState(), home, input, NOW)
    expect(outcome).toEqual({ kind: 'invited' })
    expect(demo.invitationsOf(state, home)[0]).toMatchObject({
      email: 'new.person@example.test',
      displayName: 'New Person',
      language: 'tr',
      state: 'open',
    })
    // Nobody joined: no member was added.
    expect(demo.detailsOf(state, home).members).toHaveLength(demo.detailsOf(createInitialState(), home).members.length)
  })

  it('normalises the address', () => {
    const { state } = demo.invite(createInitialState(), home, { ...input, email: '  New.Person@Example.test ' }, NOW)
    expect(demo.invitationsOf(state, home)[0].email).toBe('new.person@example.test')
  })

  it('adds someone who already has an account, with their own name', () => {
    const start = createInitialState()
    const created = reducer(start, { type: 'createProject', id: 'new-1', draft })
    const { outcome, state } = demo.invite(
      created,
      'new-1',
      { email: demo.sampleEmail('tom'), displayName: 'Tommy typed', language: 'en' },
      NOW,
    )
    expect(outcome).toEqual({ kind: 'added', displayName: 'Tom Bennett' })
    expect(demo.detailsOf(state, 'new-1').members.map((member) => member.displayName)).toContain('Tom Bennett')
    expect(demo.invitationsOf(state, 'new-1')).toEqual([])
  })

  it('refuses a member, an open invitation and Burak himself', () => {
    expect(refusal(() => demo.invite(createInitialState(), home, { ...input, email: demo.sampleEmail('tom') })).code).toBe(
      'already_member',
    )
    expect(refusal(() => demo.invite(createInitialState(), home, { ...input, email: demo.sampleEmail('burak') })).code).toBe(
      'cannot_invite_consultant',
    )
    const { state } = demo.invite(createInitialState(), home, input, NOW)
    expect(refusal(() => demo.invite(state, home, input, NOW)).code).toBe('already_invited')
  })

  it('says "try later" after three invitations to one address in a day, and sends nothing more', () => {
    let state = createInitialState()
    for (let i = 0; i < 3; i++) {
      state = demo.invite(state, home, input, NOW).state
      const open = demo.invitationsOf(state, home)[0]
      state = demo.revokeInvitation(state, open.id)
    }
    const fourth = demo.invite(state, home, input, NOW)
    expect(fourth.outcome).toEqual({ kind: 'tryLater' })
    expect(demo.invitationsOf(fourth.state, home)).toHaveLength(3)
  })

  it('revokes an open invitation once, and refuses to copy a link for a revoked one', () => {
    const { state } = demo.invite(createInitialState(), home, input, NOW)
    const id = demo.invitationsOf(state, home)[0].id
    demo.checkInvitationOpen(state, id)
    const revoked = reducer(state, { type: 'revokeInvitation', invitationId: id })
    expect(demo.invitationsOf(revoked, home)[0].state).toBe('revoked')
    expect(refusal(() => demo.revokeInvitation(revoked, id)).code).toBe('invitation_not_open')
    expect(refusal(() => demo.checkInvitationOpen(revoked, id)).code).toBe('invitation_not_open')
  })
})

describe('the demo: sign-ins and removing', () => {
  it('has invented sample sign-ins, one live and one ended', () => {
    const sessions = demo.sessionsOf(createInitialState(), 'elif')
    expect(sessions.filter((session) => session.endedAt === null)).toHaveLength(1)
    expect(sessions.filter((session) => session.endedAt !== null)).toHaveLength(1)
  })

  it('ends one sign-in and leaves the others', () => {
    const state = reducer(createInitialState(), { type: 'endSession', sessionId: 'elif-s1', now: NOW.toISOString() })
    expect(demo.sessionsOf(state, 'elif').find((session) => session.id === 'elif-s1')?.endedAt).toBe(NOW.toISOString())
    expect(demo.sessionsOf(state, 'tom').every((session) => session.id !== 'elif-s1')).toBe(true)
    expect(demo.sessionsOf(state, 'tom').find((session) => session.id === 'tom-s1')?.endedAt).toBeNull()
  })

  it('removes a member: out of the project, signed out everywhere, and out of their room', () => {
    const state = reducer(createInitialState(), {
      type: 'removeMember',
      projectId: home,
      userId: 'elif',
      now: NOW.toISOString(),
    })
    expect(demo.detailsOf(state, home).members.map((member) => member.userId)).not.toContain('elif')
    expect(demo.sessionsOf(state, 'elif').every((session) => session.endedAt !== null)).toBe(true)
    expect(state.people.elif.roomId).toBeNull()
    // Others are untouched.
    expect(demo.detailsOf(state, home).members.map((member) => member.userId)).toContain('tom')
    expect(demo.sessionsOf(state, 'tom').some((session) => session.endedAt === null)).toBe(true)
  })

  it('revokes the removed person\'s open invitations to the project', () => {
    // Burak invites an address, it is accepted in spirit by an existing person who is later removed.
    const state = createInitialState()
    const withInvitation: AppState = {
      ...state,
      invitations: {
        [home]: [
          {
            id: 'i1',
            email: demo.sampleEmail('hasan'),
            displayName: 'Hasan',
            language: 'tr',
            state: 'open',
            createdAt: NOW.toISOString(),
            expiresAt: NOW.toISOString(),
          },
        ],
      },
    }
    const after = demo.removeMember(withInvitation, home, 'hasan', NOW)
    expect(demo.invitationsOf(after, home)[0].state).toBe('revoked')
  })

  it('never removes Burak', () => {
    expect(refusal(() => demo.removeMember(createInitialState(), home, 'burak', NOW)).code).toBe('cannot_remove_consultant')
    const state = reducer(createInitialState(), {
      type: 'removeMember',
      projectId: home,
      userId: 'burak',
      now: NOW.toISOString(),
    })
    expect(demo.detailsOf(state, home).members.map((member) => member.userId)).toContain('burak')
  })
})

describe('the demo: copied links', () => {
  it('goes to the clipboard and into no state', async () => {
    const copied: string[] = []
    const result = await copyLink(async () => demo.SAMPLE_LINK, { writeText: async (text) => void copied.push(text) })
    expect(result).toEqual({ copied: true })
    expect(copied).toEqual([demo.SAMPLE_LINK])
    // Nothing in the demo state, so nothing in local storage, ever holds a link.
    expect(JSON.stringify(createInitialState())).not.toContain(demo.SAMPLE_LINK)
    expect(JSON.stringify(createInitialState())).not.toContain('sign-in')
  })

  it('is a sample that says so', () => {
    expect(demo.SAMPLE_LINK).toContain('sample')
    expect(demo.SAMPLE_LINK).toContain('.invalid')
  })
})

describe('the demo store: a read right after a change sees it', () => {
  // The harness never re-renders, like a screen that reloads straight after an action.
  function store() {
    const latest = { current: createInitialState() }
    return createConsultantActions(latest, () => {}, () => undefined)
  }

  it('lists an invitation as revoked straight after revoking it', async () => {
    const actions = store()
    await actions.invite(home, { email: 'x@example.test', displayName: 'X', language: 'en' })
    const [open] = await actions.listInvitations(home)
    expect(open.state).toBe('open')
    await actions.revokeInvitation(open.id)
    expect((await actions.listInvitations(home))[0].state).toBe('revoked')
  })

  it('drops a member from the project straight after removing them', async () => {
    const actions = store()
    expect((await actions.getProject(home)).members.map((member) => member.userId)).toContain('elif')
    await actions.removeMember(home, 'elif')
    expect((await actions.getProject(home)).members.map((member) => member.userId)).not.toContain('elif')
  })

  it('shows a sign-in as ended straight after ending it', async () => {
    const actions = store()
    await actions.endSession('tom-s1')
    expect((await actions.listSessions('tom')).find((session) => session.id === 'tom-s1')?.endedAt).not.toBeNull()
  })

  it('shows a new project, an edit and an added person straight away', async () => {
    const actions = store()
    const id = await actions.createProject(draft)
    expect((await actions.getProject(id)).title).toEqual(draft.title)
    await actions.saveProject(id, { ...draft, title: { en: 'Renamed', tr: 'Yeni ad' } })
    expect((await actions.getProject(id)).title.en).toBe('Renamed')
    const outcome = await actions.invite(id, { email: demo.sampleEmail('tom'), displayName: 'x', language: 'en' })
    expect(outcome.kind).toBe('added')
    expect((await actions.getProject(id)).members.map((member) => member.userId)).toContain('tom')
  })

  it('still refuses, and changes nothing, when a rule says no', async () => {
    const actions = store()
    await expect(actions.removeMember(home, 'burak')).rejects.toMatchObject({ code: 'cannot_remove_consultant' })
    expect((await actions.getProject(home)).members.map((member) => member.userId)).toContain('burak')
  })
})
