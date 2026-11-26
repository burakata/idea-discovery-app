// The room from the API: what comes back from GET /projects/{id}/conversations and the
// messages, checked where it comes in (docs/engineering.md section 7). The API has no idea
// content until M3, so every list is empty and nothing is asked for.
import { DEFAULT_LANG, isLang } from '../languages'
import type { ConversationSummary, IdeaContent, MessagePage, RoomMessage } from '../state/context'
import { ApiError, type ApiClient } from './client'

type Row = Record<string, unknown>

export function emptyContent(): IdeaContent {
  return { jobFlow: [], understanding: [], openQuestions: [], similarBusinesses: [], statements: [] }
}

// A row without a usable number is left out. A state this client does not know is shown
// as finished, never as active.
export function toConversations(rows: unknown): ConversationSummary[] {
  if (!Array.isArray(rows)) return []
  const found: ConversationSummary[] = []
  for (const row of rows as Row[]) {
    if (!row || typeof row.number !== 'number' || !Number.isInteger(row.number)) continue
    found.push({
      number: row.number,
      state: row.state === 'active' ? 'active' : 'finished',
      startedAt: typeof row.startedAt === 'string' ? row.startedAt : '',
      finishedAt: typeof row.finishedAt === 'string' ? row.finishedAt : null,
    })
  }
  return found
}

// A row without an id, a writer or text is left out. A role this client does not know is
// no role, never "consultant"; a language it does not know is the default one. The API sends
// no translation until M2, and anything but text is none.
export function toMessage(row: unknown): RoomMessage | null {
  if (!row || typeof row !== 'object') return null
  const m = row as Row
  if (typeof m.id !== 'string' || m.id === '') return null
  if (typeof m.authorId !== 'string' || typeof m.text !== 'string') return null
  const left = m.authorLeft === true
  const role = m.authorRole === 'consultant' || m.authorRole === 'owner' ? m.authorRole : null
  return {
    id: m.id,
    authorId: m.authorId,
    authorName: typeof m.authorName === 'string' ? m.authorName : '',
    // Someone who has left has no role, whatever the row says.
    authorRole: left ? null : role,
    authorLeft: left,
    text: m.text,
    language: isLang(m.language) ? m.language : DEFAULT_LANG,
    translation: typeof m.translation === 'string' && m.translation !== '' ? m.translation : null,
    createdAt: typeof m.createdAt === 'string' ? m.createdAt : '',
  }
}

// Without a cursor the client could not ask for "what follows", so an answer without one is refused.
export function toMessagePage(body: unknown): MessagePage {
  const page = (body ?? {}) as Row
  if (!Array.isArray(page.messages) || typeof page.cursor !== 'string' || page.cursor === '') {
    throw new ApiError(502, null)
  }
  const messages: RoomMessage[] = []
  for (const row of page.messages) {
    const message = toMessage(row)
    if (message) messages.push(message)
  }
  return { messages, cursor: page.cursor }
}

// The discussion's calls. The cursor goes back as `after`, exactly as given.
export function createConversationApi(api: ApiClient) {
  const id = encodeURIComponent
  return {
    async list(projectId: string): Promise<ConversationSummary[]> {
      return toConversations(await api.get<unknown>(`/projects/${id(projectId)}/conversations`))
    },

    async read(projectId: string, number: number, cursor?: string): Promise<MessagePage> {
      const after = cursor === undefined ? '' : `?after=${id(cursor)}`
      return toMessagePage(await api.get<unknown>(`/projects/${id(projectId)}/conversations/${number}/messages${after}`))
    },

    async post(projectId: string, text: string): Promise<RoomMessage> {
      let body: unknown
      try {
        body = await api.post<unknown>(`/projects/${id(projectId)}/conversations/active/messages`, { text })
      } catch (failure) {
        // On this call "invalid_request" means the text: an empty message or a bad character.
        if (failure instanceof ApiError && failure.code === 'invalid_request') {
          throw new ApiError(failure.status, 'message_not_valid')
        }
        throw failure
      }
      const message = toMessage(body)
      if (!message) throw new ApiError(502, null)
      return message
    },

    async finish(projectId: string): Promise<void> {
      await api.post(`/consultant/projects/${id(projectId)}/conversations/active/finish`)
    },

    async start(projectId: string): Promise<ConversationSummary> {
      const started = toConversations([await api.post<unknown>(`/consultant/projects/${id(projectId)}/conversations`)])
      if (started.length !== 1) throw new ApiError(502, null)
      return started[0]
    },
  }
}
