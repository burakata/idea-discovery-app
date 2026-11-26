// Small rules of the room, as plain code so they can be tested.
import type { ConversationSummary, Room, RoomMember } from './context'

// Where a project's room lives. The one place that builds these addresses.
export function roomPath(projectId: string, section = ''): string {
  return `/projects/${encodeURIComponent(projectId)}${section ? `/${section}` : ''}`
}

// The conversation the room's header names: the active one, else the latest.
export function shownConversation(conversations: ConversationSummary[]): ConversationSummary | undefined {
  const latest = [...conversations].sort((a, b) => b.number - a.number)
  return latest.find((conversation) => conversation.state === 'active') ?? latest[0]
}

// Whether the room's Discussion nav item and Join discussion button show: the room has a
// conversation (finished ones stay readable). The same in both builds.
export function hasDiscussion(room: Room): boolean {
  return room.conversations.length > 0
}

// The conversation the Discussion shows: the one named in the address (?c=<number>) if the
// room has it, else the one the header names (the active one, or the latest).
export function conversationToShow(conversations: ConversationSummary[], requested: string | null): number | undefined {
  const asked = requested !== null && /^\d+$/.test(requested) ? Number(requested) : undefined
  if (asked !== undefined && conversations.some((conversation) => conversation.number === asked)) return asked
  return shownConversation(conversations)?.number
}

// The people shown beside the discussion: Burak first, then the owners as the API listed them.
// There is no limit on owners, and the AI assistant is not a member, so it is not here.
export function participantRows(room: Room): { userId: string; name: string; role: RoomMember['role'] }[] {
  const rows = room.members.map(({ userId, displayName, role }) => ({ userId, name: displayName, role }))
  return [...rows.filter((row) => row.role === 'consultant'), ...rows.filter((row) => row.role !== 'consultant')]
}

// What this person may do in the conversation shown. Anyone in the project writes in the
// active conversation and nowhere else; only Burak finishes it, and starts the next one
// when none is active. The server decides again on every call.
export function conversationControls(
  viewer: { isConsultant: boolean },
  room: Room,
  shownNumber: number,
): { canWrite: boolean; canFinish: boolean; canStart: boolean } {
  const canWrite = room.conversations.some(
    (conversation) => conversation.number === shownNumber && conversation.state === 'active',
  )
  const noneActive = !room.conversations.some((conversation) => conversation.state === 'active')
  return { canWrite, canFinish: viewer.isConsultant && canWrite, canStart: viewer.isConsultant && noneActive }
}
