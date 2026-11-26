// The demo's side of Burak's project and people screens: pure functions on the demo
// state, so their rules can be tested without React. Nothing is sent anywhere, the
// sign-ins are invented, and the sample links are labelled as samples. Only the demo
// build includes this file (it is imported by demoStore.tsx).
import { ApiError } from '../api/client'
import { projects } from '../projects'
import type {
  Invitation,
  InviteInput,
  InviteOutcome,
  Member,
  ProjectDetails,
  ProjectDraft,
  SignInSession,
} from './context'
import type { AppState, DemoMember, DemoTexts, Person } from './types'

// The most invitation emails to one address in a day: the API's limit.
const MAX_INVITES_PER_ADDRESS_PER_DAY = 3
const DAY_MS = 24 * 60 * 60 * 1000
const INVITATION_LIFETIME_MS = 7 * DAY_MS
const SESSION_LIFETIME_MS = 30 * DAY_MS

// The one sample link every copy in the demo gives. It opens nothing.
export const SAMPLE_LINK = 'https://example.invalid/sample-sign-in-link-demo-only'

const normalise = (email: string) => email.trim().toLowerCase()
export const sampleEmail = (personId: string) => `${personId}@example.test`

// Sample sign-ins for one person: one still live, one ended.
export function sampleSessions(personId: string, now: Date): SignInSession[] {
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString()
  const started = now.getTime() - 2 * DAY_MS
  return [
    {
      id: `${personId}-s1`,
      createdAt: ago(2 * DAY_MS),
      lastSeenAt: ago(10 * 60 * 1000),
      expiresAt: new Date(started + SESSION_LIFETIME_MS).toISOString(),
      endedAt: null,
      device:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    },
    {
      id: `${personId}-s2`,
      createdAt: ago(9 * DAY_MS),
      lastSeenAt: ago(8 * DAY_MS),
      expiresAt: new Date(now.getTime() - 9 * DAY_MS + SESSION_LIFETIME_MS).toISOString(),
      endedAt: ago(8 * DAY_MS),
      device:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
    },
  ]
}

// What a fresh demo starts with: the sample projects' people, and sample sign-ins.
export function initialPeopleState(people: Record<string, Person>, now = new Date()) {
  const members: Record<string, DemoMember[]> = {}
  for (const project of projects) {
    members[project.id] = project.participants
      .filter((participant) => participant.role !== 'assistant')
      .map((participant) => ({ userId: participant.id, email: sampleEmail(participant.id) }))
  }
  const sessions: Record<string, SignInSession[]> = {}
  for (const person of Object.values(people)) {
    if (person.role !== 'assistant') sessions[person.id] = sampleSessions(person.id, now)
  }
  const texts: Record<string, DemoTexts> = {}
  const invitations: Record<string, Invitation[]> = {}
  const joinLinks: AppState['joinLinks'] = {}
  const joinRequests: AppState['joinRequests'] = []
  return { created: [] as string[], texts, members, invitations, sessions, joinLinks, joinRequests, myJoinRequest: null }
}

// A project's title and introduction: Burak's own text if he has set it, else the sample's.
export function textsOf(state: AppState, projectId: string): DemoTexts | undefined {
  const own = state.texts[projectId]
  if (own) return own
  const sample = projects.find((project) => project.id === projectId)
  return sample ? { title: sample.name, intro: sample.intro.lead } : undefined
}

export function projectIds(state: AppState): string[] {
  return [...projects.map((project) => project.id), ...state.created]
}

export function newProjectId(state: AppState): string {
  return `new-${state.seq}`
}

export function createProject(state: AppState, id: string, draft: ProjectDraft): AppState {
  return {
    ...state,
    seq: state.seq + 1,
    created: [...state.created, id],
    texts: { ...state.texts, [id]: draft },
    // Like the real app: Burak is the first member.
    members: { ...state.members, [id]: [{ userId: 'burak', email: sampleEmail('burak') }] },
  }
}

export function saveProject(state: AppState, id: string, draft: ProjectDraft): AppState {
  return { ...state, texts: { ...state.texts, [id]: draft } }
}

export function detailsOf(state: AppState, projectId: string): ProjectDetails {
  const texts = textsOf(state, projectId)
  if (!texts) throw new ApiError(404, null)
  const members: Member[] = (state.members[projectId] ?? []).map((member) => {
    const person = state.people[member.userId]
    return {
      userId: member.userId,
      displayName: person.name,
      role: person.role === 'consultant' ? 'consultant' : 'owner',
      email: member.email,
    }
  })
  members.sort((a, b) => Number(b.role === 'consultant') - Number(a.role === 'consultant'))
  return { id: projectId, title: texts.title, intro: texts.intro, members }
}

export function invitationsOf(state: AppState, projectId: string): Invitation[] {
  if (!textsOf(state, projectId)) throw new ApiError(404, null)
  return [...(state.invitations[projectId] ?? [])].reverse()
}

// The API's rules for an invitation, on demo data: the same refusals and outcomes.
// Returns the outcome to show and the new state; throws the refusal otherwise.
export function invite(
  state: AppState,
  projectId: string,
  input: InviteInput,
  now = new Date(),
): { outcome: InviteOutcome; state: AppState } {
  if (!textsOf(state, projectId)) throw new ApiError(404, null)
  const email = normalise(input.email)
  const existing = Object.values(state.people).find(
    (person) => person.role !== 'assistant' && sampleEmail(person.id) === email,
  )
  if (existing?.role === 'consultant') throw new ApiError(409, 'cannot_invite_consultant')
  if (existing && (state.members[projectId] ?? []).some((member) => member.userId === existing.id)) {
    throw new ApiError(409, 'already_member')
  }
  const sent = (state.invitations[projectId] ?? []).filter((entry) => entry.email === email)
  if (sent.some((entry) => entry.state === 'open')) throw new ApiError(409, 'already_invited')
  const today = sent.filter((entry) => now.getTime() - new Date(entry.createdAt).getTime() < DAY_MS)
  if (today.length >= MAX_INVITES_PER_ADDRESS_PER_DAY) return { outcome: { kind: 'tryLater' }, state }

  if (existing) {
    // An existing account is added at once and keeps its own name.
    const room = projects.some((project) => project.id === projectId) && existing.roomId === null
    return {
      outcome: { kind: 'added', displayName: existing.name },
      state: {
        ...state,
        members: {
          ...state.members,
          [projectId]: [...(state.members[projectId] ?? []), { userId: existing.id, email }],
        },
        people: room ? { ...state.people, [existing.id]: { ...existing, roomId: projectId } } : state.people,
      },
    }
  }
  const invitation: Invitation = {
    id: `inv-${state.seq}`,
    email,
    displayName: input.displayName.trim(),
    language: input.language,
    state: 'open',
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS).toISOString(),
  }
  return {
    outcome: { kind: 'invited' },
    state: {
      ...state,
      seq: state.seq + 1,
      invitations: { ...state.invitations, [projectId]: [...(state.invitations[projectId] ?? []), invitation] },
    },
  }
}

function findInvitation(state: AppState, invitationId: string) {
  for (const [projectId, list] of Object.entries(state.invitations)) {
    const invitation = list.find((entry) => entry.id === invitationId)
    if (invitation) return { projectId, invitation }
  }
  throw new ApiError(404, null)
}

export function revokeInvitation(state: AppState, invitationId: string): AppState {
  const { projectId, invitation } = findInvitation(state, invitationId)
  if (invitation.state !== 'open') throw new ApiError(409, 'invitation_not_open')
  return {
    ...state,
    invitations: {
      ...state.invitations,
      [projectId]: state.invitations[projectId].map((entry) =>
        entry.id === invitationId ? { ...entry, state: 'revoked' } : entry,
      ),
    },
  }
}

// Like the API, a link can only be copied for an invitation that is still open.
export function checkInvitationOpen(state: AppState, invitationId: string): void {
  if (findInvitation(state, invitationId).invitation.state !== 'open') throw new ApiError(409, 'invitation_not_open')
}

export function sessionsOf(state: AppState, userId: string): SignInSession[] {
  if (!state.people[userId]) throw new ApiError(404, null)
  return state.sessions[userId] ?? []
}

export function endSession(state: AppState, sessionId: string, now = new Date()): AppState {
  const sessions: Record<string, SignInSession[]> = {}
  let found = false
  for (const [userId, list] of Object.entries(state.sessions)) {
    sessions[userId] = list.map((entry) => {
      if (entry.id !== sessionId) return entry
      found = true
      return entry.endedAt ? entry : { ...entry, endedAt: now.toISOString() }
    })
  }
  if (!found) throw new ApiError(404, null)
  return { ...state, sessions }
}

// Removing someone ends their access at once, as the API does: the membership,
// every sign-in of theirs, and their open invitations to this project.
export function removeMember(state: AppState, projectId: string, userId: string, now = new Date()): AppState {
  const member = (state.members[projectId] ?? []).find((entry) => entry.userId === userId)
  const person = state.people[userId]
  if (!member || !person) throw new ApiError(404, null)
  if (person.role === 'consultant') throw new ApiError(409, 'cannot_remove_consultant')
  const ended = (state.sessions[userId] ?? []).map((entry) =>
    entry.endedAt ? entry : { ...entry, endedAt: now.toISOString() },
  )
  return {
    ...state,
    members: { ...state.members, [projectId]: state.members[projectId].filter((entry) => entry.userId !== userId) },
    invitations: {
      ...state.invitations,
      [projectId]: (state.invitations[projectId] ?? []).map((entry) =>
        entry.state === 'open' && entry.email === normalise(member.email) ? { ...entry, state: 'revoked' } : entry,
      ),
    },
    sessions: { ...state.sessions, [userId]: ended },
    people: person.roomId === projectId ? { ...state.people, [userId]: { ...person, roomId: null } } : state.people,
  }
}

