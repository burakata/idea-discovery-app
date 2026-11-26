// Small rules of the room, as plain code so they can be tested.
import type { ConversationSummary } from './context'

// Where a project's room lives. The one place that builds these addresses.
export function roomPath(projectId: string, section = ''): string {
  return `/projects/${encodeURIComponent(projectId)}${section ? `/${section}` : ''}`
}

// The Discussion screen joins the api build in PR 8b; until then only the demo has it.
// Its nav item and the Join discussion button follow this one condition.
export const HAS_DISCUSSION = __DEMO__ // until PR 8b

// The conversation the room's header names: the active one, else the latest.
export function shownConversation(conversations: ConversationSummary[]): ConversationSummary | undefined {
  const latest = [...conversations].sort((a, b) => b.number - a.number)
  return latest.find((conversation) => conversation.state === 'active') ?? latest[0]
}
