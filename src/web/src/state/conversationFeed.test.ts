import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import type { ConversationSummary, MessagePage, RoomMessage } from './context'
import { createConversationFeed, mergeById, type FeedVisibility } from './conversationFeed'

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

const active = (number: number): ConversationSummary => ({
  number,
  state: 'active',
  startedAt: '2026-11-20T10:00:00Z',
  finishedAt: null,
})
const finished = (number: number): ConversationSummary => ({
  number,
  state: 'finished',
  startedAt: '2026-11-10T10:00:00Z',
  finishedAt: '2026-11-19T10:00:00Z',
})

// A server whose answers the test controls, and a log of what was asked.
function setup(initial: ConversationSummary[] = [active(1)]) {
  const server = {
    list: initial,
    // Messages by conversation; a cursor is the number of messages already read.
    messages: { 1: [] as RoomMessage[] } as Record<number, RoomMessage[]>,
    fail: null as unknown,
  }
  const reads: { number: number; cursor: string | undefined }[] = []
  let lists = 0
  const source = {
    listConversations: async () => {
      lists += 1
      if (server.fail) throw server.fail
      return server.list
    },
    readMessages: async (_project: string, number: number, cursor?: string): Promise<MessagePage> => {
      reads.push({ number, cursor })
      if (server.fail) throw server.fail
      const all = server.messages[number] ?? []
      return { messages: all.slice(cursor ? Number(cursor) : 0), cursor: String(all.length) }
    },
  }

  // Timers that run only when the test says so.
  const waiting = new Map<number, () => void>()
  let next = 1
  const timers = {
    set: (run: () => void) => {
      waiting.set(next, run)
      return next++
    },
    clear: (handle: unknown) => {
      waiting.delete(handle as number)
    },
  }
  const tick = async () => {
    const [handle, run] = [...waiting.entries()][0] ?? []
    if (handle === undefined) throw new Error('no timer is waiting')
    waiting.delete(handle)
    run()
    await settle()
  }

  let hidden = false
  const listeners = new Set<() => void>()
  const visibility: FeedVisibility = {
    isHidden: () => hidden,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  const setHidden = async (value: boolean) => {
    hidden = value
    listeners.forEach((listener) => listener())
    await settle()
  }

  const feed = createConversationFeed({
    projectId: 'p1',
    number: 1,
    conversations: initial,
    source,
    timers,
    visibility,
  })
  return { feed, server, reads, lists: () => lists, waiting, tick, setHidden }
}

// Lets every pending promise finish.
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

const ids = (messages: RoomMessage[]) => messages.map((entry) => entry.id)

describe('mergeById', () => {
  it('keeps what is held and adds only messages with a new id, in order', () => {
    const held = [message('a'), message('b')]
    expect(ids(mergeById(held, [message('b'), message('c'), message('c')]))).toEqual(['a', 'b', 'c'])
  })
})

describe('the feed reads the conversation', () => {
  it('reads the whole conversation first, with no cursor', async () => {
    const { feed, server, reads } = setup()
    server.messages[1] = [message('a'), message('b')]
    feed.start()
    await settle()
    expect(reads).toEqual([{ number: 1, cursor: undefined }])
    expect(ids(feed.getState().messages)).toEqual(['a', 'b'])
    expect(feed.getState().loaded).toBe(true)
    feed.stop()
  })

  it('carries the cursor forward: each poll reads what follows the last one', async () => {
    const { feed, server, reads, tick } = setup()
    server.messages[1] = [message('a')]
    feed.start()
    await settle()
    server.messages[1].push(message('b'))
    await tick()
    server.messages[1].push(message('c'))
    await tick()
    expect(reads.map((read) => read.cursor)).toEqual([undefined, '1', '2'])
    expect(ids(feed.getState().messages)).toEqual(['a', 'b', 'c'])
    feed.stop()
  })

  it('re-reads the conversation list every round, so a conversation Burak starts shows up', async () => {
    const { feed, server, tick } = setup()
    feed.start()
    await settle()
    server.list = [active(1), active(2)]
    await tick()
    expect(feed.getState().conversations.map((entry) => entry.number)).toEqual([1, 2])
    feed.stop()
  })
})

describe('the feed never shows a message twice', () => {
  it('shows a message posted here once, even after the poll returns it', async () => {
    const { feed, server, tick } = setup()
    feed.start()
    await settle()
    const mine = message('mine')
    feed.add(mine)
    expect(ids(feed.getState().messages)).toEqual(['mine'])
    server.messages[1] = [mine, message('theirs')]
    await tick()
    expect(ids(feed.getState().messages)).toEqual(['mine', 'theirs'])
    feed.stop()
  })

  it('puts a message the server listed before a sent one in the server order', async () => {
    const { feed, server, tick } = setup()
    feed.start()
    await settle()
    feed.add(message('mine'))
    // The server stored theirs first, then mine; the poll returns both.
    server.messages[1] = [message('theirs'), message('mine')]
    await tick()
    expect(ids(feed.getState().messages)).toEqual(['theirs', 'mine'])
    feed.stop()
  })

  it('ignores adding a message that is already shown', async () => {
    const { feed } = setup()
    feed.start()
    await settle()
    feed.add(message('mine'))
    feed.add(message('mine'))
    expect(ids(feed.getState().messages)).toEqual(['mine'])
    feed.stop()
  })
})

describe('the feed and a hidden page', () => {
  it('does not poll while the page is hidden, and catches up at once when it returns', async () => {
    const { feed, server, reads, lists, waiting, setHidden } = setup()
    feed.start()
    await settle()
    expect(waiting.size).toBe(1)

    await setHidden(true)
    expect(waiting.size).toBe(0)
    const before = reads.length
    server.messages[1] = [message('while-away')]
    await settle()
    expect(reads.length).toBe(before)

    const listsBefore = lists()
    await setHidden(false)
    expect(reads.length).toBe(before + 1)
    expect(lists()).toBe(listsBefore + 1)
    expect(ids(feed.getState().messages)).toEqual(['while-away'])
    // And it carries on polling afterwards.
    expect(waiting.size).toBe(1)
    feed.stop()
  })

  it('reads the conversation even when opened on a hidden page, but then waits', async () => {
    const { feed, server, reads, waiting, setHidden } = setup()
    server.messages[1] = [message('a')]
    await setHidden(true)
    feed.start()
    await settle()
    expect(ids(feed.getState().messages)).toEqual(['a'])
    expect(waiting.size).toBe(0)
    await setHidden(false)
    expect(reads).toHaveLength(2)
    feed.stop()
  })
})

describe('the feed and a finished conversation', () => {
  it('does not poll the messages of a conversation that was finished when it was opened', async () => {
    const { feed, server, reads, lists, tick } = setup([finished(1)])
    server.messages[1] = [message('a')]
    feed.start()
    await settle()
    expect(reads).toHaveLength(1)
    await tick()
    await tick()
    // Only the first full read; the list is still read each round.
    expect(reads).toHaveLength(1)
    expect(lists()).toBe(2)
    feed.stop()
  })

  it('reads once more after learning it finished, so the last message is not missed, then stops reading', async () => {
    const { feed, server, reads, tick } = setup()
    feed.start()
    await settle()
    // A message arrives and the conversation is finished, both before the next poll.
    server.messages[1] = [message('last')]
    server.list = [finished(1)]
    await tick()
    expect(ids(feed.getState().messages)).toEqual(['last'])
    expect(reads).toHaveLength(2)
    await tick()
    await tick()
    expect(reads).toHaveLength(2)
    feed.stop()
  })

  it('polls the list of a finished conversation, so the next one shows up', async () => {
    const { feed, server, tick } = setup([finished(1)])
    feed.start()
    await settle()
    server.list = [finished(1), active(2)]
    await tick()
    expect(feed.getState().conversations.map((entry) => entry.number)).toEqual([1, 2])
    feed.stop()
  })
})

describe('the feed and a failed round', () => {
  it('sets retrying, tries again at the next round, and clears it on success', async () => {
    const { feed, server, tick } = setup()
    feed.start()
    await settle()
    expect(feed.getState().retrying).toBe(false)

    server.fail = new ApiError(0, null)
    await tick()
    expect(feed.getState().retrying).toBe(true)
    await tick()
    expect(feed.getState().retrying).toBe(true)

    server.fail = null
    server.messages[1] = [message('back')]
    await tick()
    expect(feed.getState().retrying).toBe(false)
    expect(ids(feed.getState().messages)).toEqual(['back'])
    feed.stop()
  })

  it('tries the first full read again after it failed', async () => {
    const { feed, server, reads, tick } = setup()
    server.fail = new ApiError(500, null)
    server.messages[1] = [message('a')]
    feed.start()
    await settle()
    expect(feed.getState()).toMatchObject({ loaded: false, retrying: true })
    server.fail = null
    await tick()
    expect(reads.at(-1)).toEqual({ number: 1, cursor: undefined })
    expect(feed.getState()).toMatchObject({ loaded: true, retrying: false })
    feed.stop()
  })

  it.each([401, 404])('only stops after a %i, which the api client has already acted on', async (status) => {
    const { feed, server, waiting } = setup()
    feed.start()
    await settle()
    server.fail = new ApiError(status, null)
    await feed.refresh()
    await settle()
    expect(waiting.size).toBe(0)
    expect(feed.getState().retrying).toBe(false)
  })
})

describe('the feed stops', () => {
  it('reads nothing more after stop, and ignores an answer that arrives late', async () => {
    const { feed, server, reads, waiting } = setup()
    feed.start()
    await settle()
    feed.stop()
    expect(waiting.size).toBe(0)
    const before = reads.length
    server.messages[1] = [message('late')]
    feed.refresh()
    await settle()
    expect(reads.length).toBe(before)
    expect(feed.getState().messages).toEqual([])
  })

  it('stops listening to the page', async () => {
    const { feed, setHidden, waiting } = setup()
    feed.start()
    await settle()
    feed.stop()
    await setHidden(true)
    await setHidden(false)
    expect(waiting.size).toBe(0)
  })
})

describe('showing another conversation', () => {
  it('reads that conversation from the start and drops the old one’s messages', async () => {
    const { feed, server, reads } = setup([finished(1), active(2)])
    server.messages[1] = [message('old')]
    server.messages[2] = [message('new')]
    feed.start()
    await settle()
    feed.show(2)
    expect(feed.getState().messages).toEqual([])
    await settle()
    expect(reads.at(-1)).toEqual({ number: 2, cursor: undefined })
    expect(ids(feed.getState().messages)).toEqual(['new'])
    feed.stop()
  })
})
