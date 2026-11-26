// Burak's calls: projects, invitations, members, sign-ins and links. The only place
// that knows the API's shapes for them, including its titleEn / titleTr naming, so
// the rest of the client sees plain objects. Data is checked where it comes in
// (docs/engineering.md section 7).
import { DEFAULT_LANG, isLang, LANGS, type Lang } from '../languages'
import type { Bilingual } from '../projects/types'
import type {
  Invitation,
  InvitationState,
  InviteInput,
  InviteOutcome,
  Member,
  ProjectDetails,
  ProjectDraft,
  SignInSession,
} from '../state/context'
import { ApiError, type ApiClient } from './client'

// The API names a bilingual field by adding the language: title + En = titleEn.
// This lookup is the one place that does it, for every language in languages.ts.
export function apiField(prefix: string, lang: Lang): string {
  return prefix + lang.charAt(0).toUpperCase() + lang.slice(1)
}

export function toApiProject(draft: ProjectDraft): Record<string, string> {
  const body: Record<string, string> = {}
  for (const lang of LANGS) {
    body[apiField('title', lang)] = draft.title[lang]
    body[apiField('intro', lang)] = draft.intro[lang]
  }
  return body
}

export function bilingualFrom(body: Record<string, unknown>, prefix: string): Bilingual {
  const text = {} as Bilingual
  for (const lang of LANGS) {
    const value = body[apiField(prefix, lang)]
    text[lang] = typeof value === 'string' ? value : ''
  }
  return text
}

type Row = Record<string, unknown>

const str = (value: unknown): string => (typeof value === 'string' ? value : '')
const strOrNull = (value: unknown): string | null => (typeof value === 'string' ? value : null)

function toMember(row: Row): Member {
  return {
    userId: str(row.userId),
    displayName: str(row.displayName),
    role: row.role === 'consultant' ? 'consultant' : 'owner',
    email: strOrNull(row.email),
  }
}

export function toProject(body: Row): ProjectDetails {
  return {
    id: str(body.id),
    imageVersion: strOrNull(body.imageVersion),
    title: bilingualFrom(body, 'title'),
    intro: bilingualFrom(body, 'intro'),
    members: Array.isArray(body.members) ? (body.members as Row[]).map(toMember) : [],
  }
}

const states: readonly InvitationState[] = ['open', 'accepted', 'revoked', 'expired']

export function toInvitation(row: Row): Invitation {
  return {
    id: str(row.id),
    email: str(row.email),
    displayName: str(row.displayName),
    language: isLang(row.language) ? row.language : DEFAULT_LANG,
    // A state this client does not know is shown as not open, never as open.
    state: states.find((state) => state === row.state) ?? 'expired',
    createdAt: str(row.createdAt),
    expiresAt: str(row.expiresAt),
  }
}

export function toSession(row: Row): SignInSession {
  return {
    id: str(row.id),
    createdAt: str(row.createdAt),
    lastSeenAt: strOrNull(row.lastSeenAt),
    expiresAt: str(row.expiresAt),
    endedAt: strOrNull(row.endedAt),
    device: strOrNull(row.device),
  }
}

// The answer to an invitation: 201 invited or added, or 429 "try later".
export function toInviteOutcome(body: Row): InviteOutcome {
  if (body.kind === 'added') return { kind: 'added', displayName: str(body.displayName) }
  return { kind: 'invited' }
}

// The API's limit for an uploaded image (ProjectImageEndpoints.MaxFileBytes).
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024
// The name of the file field (ProjectImageEndpoints.FieldName).
const IMAGE_FIELD = 'file'

export function createConsultantApi(api: ApiClient) {
  const id = encodeURIComponent
  return {
    async createProject(draft: ProjectDraft): Promise<ProjectDetails> {
      return toProject(await api.post<Row>('/consultant/projects', toApiProject(draft)))
    },

    async saveProject(projectId: string, draft: ProjectDraft): Promise<ProjectDetails> {
      return toProject(await api.put<Row>(`/consultant/projects/${id(projectId)}`, toApiProject(draft)))
    },

    // A 404 here means the project is gone: the session sends Burak to his list.
    // `quiet` is for a background read (the list's introductions): a 404 is not news.
    async getProject(projectId: string, quiet = false): Promise<ProjectDetails> {
      return toProject(await api.get<Row>(`/projects/${id(projectId)}`, quiet ? { expectMissing: true } : undefined))
    },

    // Returns the new version. A file over the limit is refused here, as the API would, so
    // the person is told at once instead of after the whole file has gone up.
    async uploadImage(projectId: string, file: File): Promise<string> {
      if (file.size > IMAGE_MAX_BYTES) throw new ApiError(413, null)
      const form = new FormData()
      form.append(IMAGE_FIELD, file, file.name)
      const body = await api.postForm<Row>(`/consultant/projects/${id(projectId)}/image`, form)
      const version = strOrNull(body.imageVersion)
      if (!version) throw new ApiError(502, null)
      return version
    },

    async removeImage(projectId: string): Promise<void> {
      await api.post(`/consultant/projects/${id(projectId)}/image/remove`)
    },

    // The address of a project's image; the version makes a new image a new address.
    imageUrl: (projectId: string, version: string): string =>
      api.url(`/projects/${id(projectId)}/image?v=${encodeURIComponent(version)}`),

    async invite(projectId: string, input: InviteInput): Promise<InviteOutcome> {
      try {
        const body = await api.post<Row>(
          `/consultant/projects/${id(projectId)}/invitations`,
          { email: input.email, displayName: input.displayName, language: input.language },
          { expectMissing: true },
        )
        return toInviteOutcome(body)
      } catch (failure) {
        // "Try later" is an answer to show, not a fault.
        if (failure instanceof ApiError && failure.code === 'try_later') return { kind: 'tryLater' }
        throw failure
      }
    },

    async listInvitations(projectId: string): Promise<Invitation[]> {
      const rows = await api.get<Row[]>(`/consultant/projects/${id(projectId)}/invitations`)
      return rows.map(toInvitation)
    },

    async revokeInvitation(invitationId: string): Promise<void> {
      await api.post(`/consultant/invitations/${id(invitationId)}/revoke`, undefined, { expectMissing: true })
    },

    async invitationLink(invitationId: string): Promise<string> {
      const body = await api.post<Row>(`/consultant/invitations/${id(invitationId)}/link`, undefined, {
        expectMissing: true,
      })
      return str(body.link)
    },

    async signInLink(userId: string): Promise<string> {
      const body = await api.post<Row>(`/consultant/users/${id(userId)}/sign-in-link`, undefined, {
        expectMissing: true,
      })
      return str(body.link)
    },

    async listSessions(userId: string): Promise<SignInSession[]> {
      const rows = await api.get<Row[]>(`/consultant/users/${id(userId)}/sessions`, { expectMissing: true })
      return rows.map(toSession)
    },

    async endSession(sessionId: string): Promise<void> {
      await api.post(`/consultant/sessions/${id(sessionId)}/revoke`, undefined, { expectMissing: true })
    },

    async removeMember(projectId: string, userId: string): Promise<void> {
      await api.post(`/consultant/projects/${id(projectId)}/members/${id(userId)}/remove`, undefined, {
        expectMissing: true,
      })
    },
  }
}

export type ConsultantApi = ReturnType<typeof createConsultantApi>
