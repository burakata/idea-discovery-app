// Connects the plain feed (conversationFeed.ts) to React: one feed per project, started when
// the screen opens and stopped when it closes, showing the conversation the address names
// (`requested`, the ?c= value) or else the active one. The list it keeps up to date decides
// that, so a conversation Burak starts becomes the one shown.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ConversationSummary } from './context'
import { createConversationFeed, type ConversationFeed, type FeedSource } from './conversationFeed'
import { conversationToShow } from './roomRules'

export function useConversationFeed(
  projectId: string,
  roomConversations: ConversationSummary[],
  requested: string | null,
  source: FeedSource,
  intervalMs?: number,
) {
  const [feed, setFeed] = useState<ConversationFeed | null>(null)
  const state = useSyncExternalStore(
    (listener) => feed?.subscribe(listener) ?? (() => {}),
    () => feed?.getState() ?? null,
  )
  const conversations = state?.conversations ?? roomConversations
  const number = conversationToShow(conversations, requested) ?? 0

  // The newest calls, whichever render made them, so the feed never needs to be made again for them.
  const latest = useRef(source)
  latest.current = source
  // Where a new feed starts: what this render shows.
  const start = useRef({ conversations: roomConversations, number })
  start.current = { conversations: roomConversations, number }

  useEffect(() => {
    const made = createConversationFeed({
      projectId,
      number: start.current.number,
      conversations: start.current.conversations,
      intervalMs,
      source: {
        listConversations: (id) => latest.current.listConversations(id),
        readMessages: (id, n, cursor) => latest.current.readMessages(id, n, cursor),
      },
    })
    made.start()
    setFeed(made)
    return () => made.stop()
  }, [projectId, intervalMs])

  useEffect(() => {
    feed?.show(number)
  }, [feed, number])

  return { feed, state, conversations, number }
}
