// The one module that talks to the API. Screens never call fetch (docs/engineering.md
// section 8); the store does, through this client.
//
// - Calls go to /api/... on the page's own origin, with the session cookie.
// - Every request that changes something carries a CSRF token from GET /auth/csrf
//   as X-CSRF-TOKEN. The browser adds the Origin header itself.
// - Tokens are kept in memory only and never logged or stored.
// - Nothing the API says is shown as it is: a code or status maps to a key in the
//   strings files.
import type { consultant } from '../strings/consultant'
import type { Strings } from '../strings/en'

export type ErrorKey = keyof Strings['errors']
// Burak's screens are English only, so their refusals have their own texts.
export type ConsultantErrorKey = keyof typeof consultant.errors

// What the store does about a status, whichever call returned it.
export type StatusEffect = 'signedOut' | 'toList' | null

export function statusEffect(status: number): StatusEffect {
  if (status === 401) return 'signedOut'
  if (status === 404) return 'toList'
  return null
}

const codeKeys: Record<string, ErrorKey> = {
  link_not_valid: 'linkNotValid',
}

export function errorKey(status: number, code: string | null): ErrorKey {
  if (code && code in codeKeys) return codeKeys[code]
  if (status === 429) return 'tooManyTries'
  if (status === 0) return 'network'
  return 'generic'
}

const consultantCodeKeys: Record<string, ConsultantErrorKey> = {
  invalid_request: 'invalidRequest',
  already_member: 'alreadyMember',
  already_invited: 'alreadyInvited',
  cannot_invite_consultant: 'ownEmail',
  invitation_not_open: 'invitationNotOpen',
  cannot_remove_consultant: 'cannotRemoveConsultant',
  try_later: 'tryLater',
}

export function consultantErrorKey(status: number, code: string | null): ConsultantErrorKey {
  if (code && code in consultantCodeKeys) return consultantCodeKeys[code]
  if (status === 404) return 'notFound'
  if (status === 429) return 'tooManyTries'
  if (status === 0) return 'network'
  return 'generic'
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | null

  // Status 0 means the request never got an answer.
  constructor(status: number, code: string | null) {
    super(`API ${status}`)
    this.status = status
    this.code = code
  }

  get key(): ErrorKey {
    return errorKey(this.status, this.code)
  }

  get consultantKey(): ConsultantErrorKey {
    return consultantErrorKey(this.status, this.code)
  }
}

export interface ApiClientOptions {
  fetch?: typeof fetch
  // Called for a 401 or 404 from any call, before the error is thrown.
  onStatus?: (effect: Exclude<StatusEffect, null>) => void
}

interface RequestOptions {
  // For calls where a 401 is an ordinary answer, such as asking who is signed in.
  expectSignedOut?: boolean
  // For calls about one thing inside a project (an invitation, a session): a 404 says
  // that thing is gone, not the project, so the person stays where they are.
  expectMissing?: boolean
}

export function createApiClient(options: ApiClientOptions = {}) {
  const send = options.fetch ?? ((input, init) => fetch(input, init))
  let csrf: string | null = null

  async function csrfToken(fresh = false): Promise<string> {
    if (csrf && !fresh) return csrf
    const response = await call('GET', '/auth/csrf')
    const body = (await response.json()) as { token?: unknown }
    if (typeof body.token !== 'string') throw new ApiError(response.status, null)
    csrf = body.token
    return csrf
  }

  async function call(method: string, path: string, body?: unknown, token?: string): Promise<Response> {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    if (token) headers['X-CSRF-TOKEN'] = token
    try {
      return await send(`/api${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, null)
    }
  }

  async function codeOf(response: Response): Promise<string | null> {
    try {
      const body = (await response.json()) as { error?: unknown }
      return typeof body.error === 'string' ? body.error : null
    } catch {
      return null
    }
  }

  async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    const changes = method !== 'GET'
    let response = await call(method, path, body, changes ? await csrfToken() : undefined)
    // A stale token (another tab signed in or out) is refused once; ask for a new one.
    if (changes && response.status === 403 && (await codeOf(response.clone())) === 'request_refused') {
      response = await call(method, path, body, await csrfToken(true))
    }
    if (response.ok) {
      return (response.status === 204 || response.status === 202 ? undefined : await response.json()) as T
    }
    const effect = statusEffect(response.status)
    if (
      effect &&
      !(effect === 'signedOut' && opts.expectSignedOut) &&
      !(effect === 'toList' && opts.expectMissing)
    ) {
      options.onStatus?.(effect)
    }
    throw new ApiError(response.status, await codeOf(response))
  }

  return {
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, undefined, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) => request<T>('POST', path, body ?? {}, opts),
    put: <T>(path: string, body: unknown, opts?: RequestOptions) => request<T>('PUT', path, body, opts),
    // The token is bound to who is signed in, so ask for a new one after signing in or out.
    forgetCsrfToken: () => {
      csrf = null
    },
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
