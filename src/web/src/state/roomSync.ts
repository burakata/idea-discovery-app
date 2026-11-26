// The room's layout owns the room (title, members, conversations). A screen that learns the
// conversation list has changed, as the discussion does by polling, tells the layout through
// this context (lifted state): the layout reloads the room, so the sidebar and the
// participants follow the same list and there is one source of truth.
import { createContext, useContext } from 'react'
import type { ConversationSummary } from './context'

export type RoomSync = (conversations: ConversationSummary[]) => void

export const RoomSyncContext = createContext<RoomSync>(() => {})

export const useRoomSync = (): RoomSync => useContext(RoomSyncContext)

// Whether two lists say the same, so a poll that changed nothing reloads nothing.
export function sameConversations(a: ConversationSummary[], b: ConversationSummary[]): boolean {
  return (
    a.length === b.length &&
    a.every((x, i) => x.number === b[i].number && x.state === b[i].state && x.finishedAt === b[i].finishedAt)
  )
}
