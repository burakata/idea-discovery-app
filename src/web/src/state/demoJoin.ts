// The demo's side of asking to join: pure functions on the demo state, so the rules
// can be tested without React. Both sides are simulated in one browser. The "cookie"
// is `myJoinRequest` in the demo state, and nothing is sent anywhere. Only the demo
// build includes this file (it is imported by demoStore.tsx).
import { ApiError } from '../api/client'
import { DEFAULT_LANG } from '../languages'
import { projects } from '../projects'
import type { JoinInput, JoinRequest, JoinState } from './context'
import { projectIds, textsOf } from './demoPeople'
import type { AppState, DemoJoinRequest, Person } from './types'

const HOUR_MS = 60 * 60 * 1000
// The API's numbers: a request waits 48 hours, an approval can be claimed for 48 hours.
const REQUEST_LIFETIME_MS = 48 * HOUR_MS
const APPROVAL_WINDOW_MS = 48 * HOUR_MS
const MAX_WAITING = 20
const MAX_NAME = 80
const MAX_EMAIL = 254

// What the API's name rules come to for ordinary names: letters, marks, spaces,
// apostrophes, hyphens and full stops.
const NAME_PATTERN = /^[\p{L}\p{M}' .’-]+$/u

export function cleanName(raw: string | undefined): string | null {
  if (raw === undefined) return null
  const name = raw.normalize('NFKC').replace(/\s+/g, ' ').trim()
  return name.length > 0 && name.length <= MAX_NAME && NAME_PATTERN.test(name) ? name : null
}

// Accents dropped, the Turkish dotted and dotless I as one letter: the API's warning key.
export function nameKey(name: string): string {
  return (cleanName(name) ?? name.trim())
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

// The code a project's link carries until Burak replaces it. Invented, and not a credential.
export const defaultCode = (projectId: string) => `demo-${projectId}`

export function codeOf(state: AppState, projectId: string): string {
  return state.joinLinks[projectId]?.code ?? defaultCode(projectId)
}

export const isAsking = (state: AppState, projectId: string): boolean => state.joinLinks[projectId]?.on === true

// The sample link: where the demo's own ask-to-join page lives. Built when copied, never stored.
export function joinLink(state: AppState, projectId: string, base: string): string {
  return `${base}/join/${codeOf(state, projectId)}`
}

function projectOfCode(state: AppState, code: string): string | null {
  return projectIds(state).find((id) => isAsking(state, id) && codeOf(state, id) === code) ?? null
}

function mine(state: AppState): DemoJoinRequest | undefined {
  return state.joinRequests.find((request) => request.id === state.myJoinRequest)
}

function checkProject(state: AppState, projectId: string): void {
  if (!textsOf(state, projectId)) throw new ApiError(404, null)
}

// ---- Burak's side ----

export function turnOn(state: AppState, projectId: string): AppState {
  checkProject(state, projectId)
  return { ...state, joinLinks: { ...state.joinLinks, [projectId]: { code: codeOf(state, projectId), on: true } } }
}

export function turnOff(state: AppState, projectId: string): AppState {
  checkProject(state, projectId)
  return { ...state, joinLinks: { ...state.joinLinks, [projectId]: { code: codeOf(state, projectId), on: false } } }
}

// A new code; the old one stops working, and whether asking is on stays as it was.
export function renew(state: AppState, projectId: string): AppState {
  checkProject(state, projectId)
  return {
    ...state,
    seq: state.seq + 1,
    joinLinks: {
      ...state.joinLinks,
      [projectId]: { code: `demo-${projectId}-${state.seq}`, on: isAsking(state, projectId) },
    },
  }
}

const waitingNow = (request: DemoJoinRequest, now: Date) =>
  request.state === 'pending' && new Date(request.expiresAt) > now

export function listRequests(state: AppState, projectId: string, now: Date): JoinRequest[] {
  checkProject(state, projectId)
  const taken = new Set((state.members[projectId] ?? []).map((member) => nameKey(state.people[member.userId].name)))
  return state.joinRequests
    .filter((request) => request.projectId === projectId && waitingNow(request, now))
    .map((request) => ({
      id: request.id,
      name: request.name,
      uncheckedEmail: request.uncheckedEmail,
      device: request.device,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      nameMatchesMember: taken.has(nameKey(request.name)),
    }))
}

function findWaiting(state: AppState, requestId: string, now: Date): DemoJoinRequest {
  const request = state.joinRequests.find((entry) => entry.id === requestId)
  if (!request) throw new ApiError(404, null)
  if (!waitingNow(request, now)) throw new ApiError(409, 'request_not_waiting')
  return request
}

const replaceRequest = (state: AppState, next: DemoJoinRequest): AppState => ({
  ...state,
  joinRequests: state.joinRequests.map((entry) => (entry.id === next.id ? next : entry)),
})

// Approving makes the person a business owner of the project, as the API does: a new
// account with no email. Returns the name they were given.
export function approve(
  state: AppState,
  requestId: string,
  displayName: string | undefined,
  now: Date,
): { state: AppState; displayName: string } {
  const corrected = cleanName(displayName)
  if (displayName !== undefined && corrected === null) throw new ApiError(400, 'invalid_request')
  const request = findWaiting(state, requestId, now)
  const name = corrected ?? request.name
  const userId = `joined-${state.seq}`
  const person: Person = {
    id: userId,
    role: 'owner',
    name,
    language: DEFAULT_LANG,
    joined: true,
    // The sample projects have a room to open; ones Burak made in the demo have none.
    roomId: projects.some((project) => project.id === request.projectId) ? request.projectId : null,
  }
  const next = replaceRequest(state, {
    ...request,
    state: 'approved',
    userId,
    approvedUntil: new Date(now.getTime() + APPROVAL_WINDOW_MS).toISOString(),
  })
  return {
    displayName: name,
    state: {
      ...next,
      seq: state.seq + 1,
      people: { ...state.people, [userId]: person },
      members: {
        ...state.members,
        [request.projectId]: [...(state.members[request.projectId] ?? []), { userId, email: '' }],
      },
      sessions: { ...state.sessions, [userId]: [] },
    },
  }
}

export function reject(state: AppState, requestId: string, now: Date): AppState {
  const request = findWaiting(state, requestId, now)
  return replaceRequest(state, { ...request, state: 'rejected' })
}

// ---- The person's side ----

export function canAsk(state: AppState, code: string): boolean {
  return projectOfCode(state, code) !== null
}

const approvedStill = (request: DemoJoinRequest, now: Date) =>
  request.approvedUntil !== undefined && new Date(request.approvedUntil) >= now

export function ask(
  state: AppState,
  code: string,
  input: JoinInput,
  device: string,
  now: Date,
): { state: AppState; status: JoinState } {
  const projectId = projectOfCode(state, code)
  if (!projectId) throw new ApiError(404, 'cannot_ask')
  const own = mine(state)
  // A browser that already waits on this project gets its own request back.
  if (own && own.projectId === projectId) {
    if (waitingNow(own, now)) return { state, status: 'pending' }
    if (own.state === 'approved' && !own.claimed && approvedStill(own, now)) return { state, status: 'approved' }
  }
  const name = cleanName(input.name)
  const email = input.email.trim()
  if (!name || email.length > MAX_EMAIL) throw new ApiError(400, 'invalid_request')
  const waiting = state.joinRequests.filter((request) => request.projectId === projectId && waitingNow(request, now))
  if (waiting.length >= MAX_WAITING) throw new ApiError(429, 'try_later')
  const request: DemoJoinRequest = {
    id: `jr-${state.seq}`,
    projectId,
    name,
    uncheckedEmail: email === '' ? null : email,
    device,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + REQUEST_LIFETIME_MS).toISOString(),
    state: 'pending',
    claimed: false,
  }
  return {
    status: 'pending',
    state: {
      ...state,
      seq: state.seq + 1,
      joinRequests: [...state.joinRequests, request],
      myJoinRequest: request.id,
    },
  }
}

// The same answers as the API: no request is "expired", whatever the reason.
// With the project link's code, a request made on another project's link reads as no request.
export function statusOf(state: AppState, now: Date, code?: string): JoinState {
  const request = mine(state)
  if (!request) return 'expired'
  if (code !== undefined && codeOf(state, request.projectId) !== code) return 'expired'
  if (request.state === 'rejected') return 'rejected'
  if (request.state === 'pending') return waitingNow(request, now) ? 'pending' : 'expired'
  return !request.claimed && approvedStill(request, now) ? 'approved' : 'expired'
}

// Signs the demo in as the person Burak approved, once. The person's language on
// the page becomes theirs, as in the API build.
export function claim(state: AppState, now: Date): AppState {
  const request = mine(state)
  if (!request || statusOf(state, now) !== 'approved' || !request.userId) throw new ApiError(400, 'cannot_claim')
  const person = state.people[request.userId]
  return {
    ...replaceRequest(state, { ...request, claimed: true }),
    myJoinRequest: null,
    signedIn: true,
    viewAs: person.id,
    people: { ...state.people, [person.id]: { ...person, language: state.guestLanguage } },
  }
}
