// Small rules of the room, as plain code so they can be tested.
import type { ConversationSummary, Room } from './context'

// Where a project's room lives. The one place that builds these addresses.
export function roomPath(projectId: string, section = ''): string {
  return `/projects/${encodeURIComponent(projectId)}${section ? `/${section}` : ''}`
}

// The conversation the room's header names: the active one, else the latest.
export function shownConversation(conversations: ConversationSummary[]): ConversationSummary | undefined {
  const latest = [...conversations].sort((a, b) => b.number - a.number)
  return latest.find((conversation) => conversation.state === 'active') ?? latest[0]
}

// Whether the room's Discussion nav item and Join discussion button show. The one rule for
// both: the room has a conversation (finished ones stay readable), and the build has a
// Discussion screen. Only the demo has one, until PR 8b. A demo project Burak created has
// no conversation.
export function hasDiscussion(room: Room): boolean {
  return __DEMO__ /* until PR 8b */ && room.conversations.length > 0
}
