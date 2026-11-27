import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import type { ConversationSummary, MessagePage, RoomMessage } from './context'
import { createConversationFeed, type FeedVisibility } from './conversationFeed'

const message = (id: string): RoomMessage => ({
  id,
  authorId: 'u1',
  authorName: 'Ayla',
  authorRole: 'owner',
  authorLeft: false,
  text: `text ${id}`,
  language: 'en',
  translation: null,
  createdAt: '2026-11-20T10:00:00Z',
})

const conversation = (state: 'active' | 'finished'): ConversationSummary => ({
  number: 1,
  state,
  startedAt: '2026-11-10T10:00:00Z',
  finishedAt: state === 'finished' ? '2026-11-19T10:00:00Z' : null,
})

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

// The final read of a conversation: the list says it is finished, and the read that follows
// may fail. Only a read that succeeds after that ends the reading.
describe('the final read of a finished conversation', () => {
  it('reads again after a failed final read, shows the late message, then stops reading', async () => {
    const server = { list: [conversation('active')], messages: [message('a')], failReads: false }
    let reads = 0
    const source = {
      listConversations: async () => server.list,
      readMessages: async (_project: string, _number: number, cursor?: string): Promise<MessagePage> => {
        reads += 1
        if (server.failReads) throw new ApiError(500, null)
        return { messages: server.messages.slice(cursor ? Number(cursor) : 0), cursor: String(server.messages.length) }
      },
    }
    const waiting: (() => void)[] = []
    const visibility: FeedVisibility = { isHidden: () => false, subscribe: () => () => {} }
    const feed = createConversationFeed({
      projectId: 'p1',
      number: 1,
      conversations: server.list,
      source,
      timers: { set: (run) => waiting.push(run), clear: () => {} },
      visibility,
    })
    const tick = async () => {
      waiting.shift()?.()
      await settle()
    }
    feed.start()
    await settle()
    expect(feed.getState().messages.map((m) => m.id)).toEqual(['a'])

    // A last message is sent and the conversation finishes; the list arrives, the read fails.
    server.messages = [message('a'), message('last')]
    server.list = [conversation('finished')]
    server.failReads = true
    await tick()
    expect(feed.getState().retrying).toBe(true)
    expect(feed.getState().messages.map((m) => m.id)).toEqual(['a'])

    // The next round reads again, shows the message and settles.
    server.failReads = false
    const readsBefore = reads
    await tick()
    expect(reads).toBe(readsBefore + 1)
    expect(feed.getState().messages.map((m) => m.id)).toEqual(['a', 'last'])
    expect(feed.getState().retrying).toBe(false)

    // After a successful final read, no more reads.
    await tick()
    await tick()
    expect(reads).toBe(readsBefore + 1)
    feed.stop()
  })
})
