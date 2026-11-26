// The discussion's messages kept up to date by polling, as plain code so its rules can be
// tested without React or real timers (an Observer, like apiSession.ts). Both builds use it.
//
// - It first reads the whole shown conversation.
// - Every few seconds, while the page is visible, it reads what follows the cursor and
//   re-reads the conversation list. While the page is hidden it waits, and when the page
//   comes back it catches up at once.
// - A message is never shown twice: messages merge by id.
// - A finished conversation cannot change, so its messages are not polled again (the list
//   still is, so a newly started conversation shows up).
// - A failed round sets `retrying`; the next round tries again and a success clears it.
// - A 401 already signs the person out (the api client), so the feed only stops. A 404 means
//   the project or conversation is gone: the feed stops and sets `gone`, and the screen sends
//   the person to their list, as the room's layout does.
import { ApiError } from '../api/client'
import type { ConversationSummary, MessagePage, RoomMessage } from './context'

export const POLL_INTERVAL_MS = 5000

export interface FeedSource {
  listConversations: (projectId: string) => Promise<ConversationSummary[]>
  readMessages: (projectId: string, number: number, cursor?: string) => Promise<MessagePage>
}

export interface FeedTimers {
  set: (run: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

export interface FeedVisibility {
  isHidden: () => boolean
  // Calls back whenever the page is shown or hidden. Returns how to stop listening.
  subscribe: (listener: () => void) => () => void
}

export interface FeedState {
  messages: RoomMessage[]
  conversations: ConversationSummary[]
  // The first read of the shown conversation has arrived.
  loaded: boolean
  // The last round failed; the next one tries again.
  retrying: boolean
  // A read got a 404: the project is gone or this person is no longer in it.
  gone: boolean
}

export interface FeedOptions {
  projectId: string
  // The conversation to show, and the list the room was loaded with.
  number: number
  conversations: ConversationSummary[]
  source: FeedSource
  intervalMs?: number
  timers?: FeedTimers
  visibility?: FeedVisibility
}

const browserTimers: FeedTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

export const browserVisibility: FeedVisibility = {
  isHidden: () => document.visibilityState === 'hidden',
  subscribe: (listener) => {
    document.addEventListener('visibilitychange', listener)
    return () => document.removeEventListener('visibilitychange', listener)
  },
}

// New messages joined to those already held: ones already held (by id) are left out.
export function mergeById(held: RoomMessage[], incoming: RoomMessage[]): RoomMessage[] {
  const seen = new Set(held.map((message) => message.id))
  const added: RoomMessage[] = []
  for (const message of incoming) {
    if (seen.has(message.id)) continue
    seen.add(message.id)
    added.push(message)
  }
  return added.length === 0 ? held : [...held, ...added]
}

export function createConversationFeed(options: FeedOptions) {
  const { projectId, source } = options
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS
  const timers = options.timers ?? browserTimers
  const visibility = options.visibility ?? browserVisibility

  let number = options.number
  // What the server has given us, in its order; and what this person sent that no read has
  // returned yet. They are shown in that order: a message sent here that the server has not
  // listed yet goes last, and drops out of the second list once a read returns it.
  let confirmed: RoomMessage[] = []
  let pending: RoomMessage[] = []
  let cursor: string | undefined
  let conversations = options.conversations
  let loaded = false
  let retrying = false
  let gone = false

  let state: FeedState = snapshot()
  const listeners = new Set<() => void>()
  let timer: unknown
  let running = false
  let again = false
  let stopped = true
  // Changes when the shown conversation does, so an answer for the old one is ignored.
  let epoch = 0
  let stopListening: (() => void) | undefined

  function snapshot(): FeedState {
    return { messages: mergeById(confirmed, pending), conversations, loaded, retrying, gone }
  }

  function publish() {
    state = snapshot()
    listeners.forEach((listener) => listener())
  }

  const isFinished = () => conversations.find((entry) => entry.number === number)?.state === 'finished'

  function stopTimer() {
    if (timer !== undefined) timers.clear(timer)
    timer = undefined
  }

  function schedule() {
    stopTimer()
    if (stopped || visibility.isHidden()) return
    timer = timers.set(() => {
      timer = undefined
      void round()
    }, intervalMs)
  }

  async function round() {
    if (stopped) return
    if (running) {
      again = true
      return
    }
    running = true
    const mine = epoch
    try {
      do {
        again = false
        // A conversation known to be finished before this round needs no more message reads.
        // One learned to be finished in this round is still read once more, after the list:
        // a message sent just before it finished is then not missed.
        const finishedBefore = cursor !== undefined && isFinished()
        try {
          // The first read of a conversation uses the list the screen already has.
          if (cursor !== undefined) {
            const list = await source.listConversations(projectId)
            if (stopped || mine !== epoch) return
            conversations = list
          }
          if (cursor === undefined || !finishedBefore) {
            const page = await source.readMessages(projectId, number, cursor)
            if (stopped || mine !== epoch) return
            confirmed = mergeById(confirmed, page.messages)
            const ids = new Set(page.messages.map((message) => message.id))
            pending = pending.filter((message) => !ids.has(message.id))
            cursor = page.cursor
            loaded = true
          }
          retrying = false
        } catch (failure) {
          if (stopped || mine !== epoch) return
          if (failure instanceof ApiError && (failure.status === 401 || failure.status === 404)) {
            gone = failure.status === 404
            publish()
            feed.stop()
            return
          }
          retrying = true
        }
        publish()
      } while (again && !stopped && mine === epoch)
    } finally {
      // A round for an older conversation leaves everything to the one show() started.
      if (mine === epoch) {
        running = false
        schedule()
      }
    }
  }

  function onVisibility() {
    if (stopped) return
    if (visibility.isHidden()) {
      stopTimer()
      return
    }
    // Back on the page: catch up at once, then carry on.
    stopTimer()
    void round()
  }

  const feed = {
    getState: () => state,

    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    // Reads the whole conversation now and keeps it up to date until stop().
    start() {
      if (!stopped) return
      stopped = false
      stopListening = visibility.subscribe(onVisibility)
      void round()
    },

    stop() {
      stopped = true
      stopTimer()
      stopListening?.()
      stopListening = undefined
    },

    // Shows another conversation of the same project: its whole text is read first.
    show(next: number) {
      if (next === number) return
      number = next
      epoch += 1
      confirmed = []
      pending = []
      cursor = undefined
      loaded = false
      retrying = false
      running = false
      again = false
      publish()
      if (!stopped) {
        stopTimer()
        void round()
      }
    },

    // A message this person has just sent: shown at once, and merged by id when a read returns it.
    add(message: RoomMessage) {
      if (confirmed.some((entry) => entry.id === message.id) || pending.some((entry) => entry.id === message.id)) return
      pending = [...pending, message]
      publish()
    },

    // Reads now, outside the usual rhythm: after this person finished or started a conversation,
    // or when a send showed it was finished.
    refresh() {
      void round()
    },
  }

  return feed
}

export type ConversationFeed = ReturnType<typeof createConversationFeed>
