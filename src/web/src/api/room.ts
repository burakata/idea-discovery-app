// The room from the API: what comes back from GET /projects/{id}/conversations, checked
// where it comes in (docs/engineering.md section 7). The API has no idea content until
// M3, so every list is empty and nothing is asked for.
import type { ConversationSummary, IdeaContent } from '../state/context'

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
