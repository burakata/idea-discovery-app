// Ask to join: the person's calls (signed out) and Burak's. The only place that knows
// the API's shapes for them. Data is checked where it comes in (docs/engineering.md
// section 7). A 404 on these calls never sends anyone to a list: it means "not open"
// or "gone", which the screens say in words.
import type { JoinInput, JoinRequest, JoinState } from '../state/context'
import { ApiError, type ApiClient, type ErrorKey } from './client'

type Row = Record<string, unknown>

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const states: readonly JoinState[] = ['pending', 'approved', 'rejected']

// The API's "stale" is a request of this browser for this link that has run out. Its
// "expired" is the no-request answer. A state this client does not know is "none", never approved.
export function toJoinState(body: Row | undefined): JoinState {
  if (body?.state === 'stale') return 'expired'
  return states.find((state) => state === body?.state) ?? 'none'
}

// Only an explicit true opens the form. An unknown code and a switched-off project
// get the same answer from the API, so they look the same here.
export function toCanAsk(body: Row | undefined): boolean {
  return body?.canAsk === true
}

export function toJoinRequest(row: Row): JoinRequest {
  return {
    id: str(row.id),
    name: str(row.name),
    uncheckedEmail: strOrNull(row.uncheckedEmail),
    device: strOrNull(row.device),
    createdAt: str(row.createdAt),
    expiresAt: str(row.expiresAt),
    nameMatchesMember: row.nameMatchesMember === true,
  }
}

// The text for a refusal on the person's pages. "invalid_request" means the name or
// email on this form; everywhere else in the owner side it stays generic.
export function joinErrorKey(failure: unknown): ErrorKey {
  if (!(failure instanceof ApiError)) return 'generic'
  return failure.code === 'invalid_request' ? 'nameNotValid' : failure.key
}

export function createJoinApi(api: ApiClient) {
  const id = encodeURIComponent
  const quiet = { expectMissing: true }
  return {
    async canAsk(code: string): Promise<boolean> {
      return toCanAsk(await api.get<Row>(`/join/${id(code)}`, quiet))
    },

    // The API answers 202 with no body the client reads; the state follows from status().
    async ask(code: string, input: JoinInput): Promise<void> {
      const email = input.email.trim()
      await api.post(`/join/${id(code)}`, { name: input.name, email: email === '' ? null : email }, quiet)
    },

    // With the project link's code, the API says whether the request is for this link;
    // a request for another link is read as no request at all, and a run-out one of this link as "expired".
    async status(code?: string): Promise<JoinState> {
      const query = code === undefined ? '' : `?code=${id(code)}`
      const body = await api.get<Row>(`/join/request${query}`, quiet)
      return body.forThisLink === false ? 'none' : toJoinState(body)
    },

    claim: <T>() => api.post<T>('/join/claim', undefined, quiet),

    // Whether asking is on: part of Burak's project details. The link in that answer is
    // not read here; copying goes through turnOn.
    async asking(projectId: string): Promise<boolean> {
      const body = await api.get<Row>(`/projects/${id(projectId)}`, quiet)
      const asking = body.askToJoin as Row | undefined
      return asking?.enabled === true
    },

    // The link goes to the clipboard through copyLink and nowhere else.
    async turnOn(projectId: string): Promise<string> {
      return str((await api.post<Row>(`/consultant/projects/${id(projectId)}/join-link`, undefined, quiet)).link)
    },

    async turnOff(projectId: string): Promise<void> {
      await api.post(`/consultant/projects/${id(projectId)}/join-link/off`, undefined, quiet)
    },

    async renew(projectId: string): Promise<string> {
      return str((await api.post<Row>(`/consultant/projects/${id(projectId)}/join-link/renew`, undefined, quiet)).link)
    },

    async listRequests(projectId: string): Promise<JoinRequest[]> {
      const rows = await api.get<Row[]>(`/consultant/projects/${id(projectId)}/join-requests`, quiet)
      return rows.map(toJoinRequest)
    },

    async approve(requestId: string, displayName?: string): Promise<string> {
      const body = await api.post<Row>(
        `/consultant/join-requests/${id(requestId)}/approve`,
        displayName === undefined ? undefined : { displayName },
        quiet,
      )
      return str(body.displayName)
    },

    async reject(requestId: string): Promise<void> {
      await api.post(`/consultant/join-requests/${id(requestId)}/reject`, undefined, quiet)
    },
  }
}

export type JoinApi = ReturnType<typeof createJoinApi>
