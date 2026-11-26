import { describe, expect, it } from 'vitest'
import type { ConversationSummary, Room } from './context'
import { conversationToShow, hasDiscussion, roomPath, shownConversation } from './roomRules'

const conversation = (number: number, state: ConversationSummary['state']): ConversationSummary => ({
  number,
  state,
  startedAt: '2026-11-10T10:00:00Z',
  finishedAt: state === 'finished' ? '2026-11-19T10:00:00Z' : null,
})

describe('roomPath', () => {
  it('opens the room, and its sections, under /projects', () => {
    expect(roomPath('g1')).toBe('/projects/g1')
    expect(roomPath('g1', 'summary')).toBe('/projects/g1/summary')
  })

  it('keeps an odd project id inside one path segment', () => {
    expect(roomPath('a/b ?')).toBe('/projects/a%2Fb%20%3F')
  })
})

describe('the conversation the header names', () => {
  it('is the active one, even when an older one is listed after it', () => {
    expect(shownConversation([conversation(1, 'finished'), conversation(2, 'active')])?.number).toBe(2)
    expect(shownConversation([conversation(2, 'active'), conversation(1, 'finished')])?.number).toBe(2)
  })

  it('is the latest one when none is active', () => {
    const shown = shownConversation([conversation(1, 'finished'), conversation(3, 'finished'), conversation(2, 'finished')])
    expect(shown).toMatchObject({ number: 3, state: 'finished' })
  })

  it('is nothing when there are no conversations', () => {
    expect(shownConversation([])).toBeUndefined()
  })
})

describe('whether a room has a Discussion', () => {
  const room = (conversations: ConversationSummary[]) => ({ conversations }) as Room

  it('has one in the demo when the room has any conversation, finished ones included', () => {
    expect(__DEMO__).toBe(true)
    expect(hasDiscussion(room([conversation(1, 'active')]))).toBe(true)
    expect(hasDiscussion(room([conversation(1, 'finished')]))).toBe(true)
  })

  it('has none without a conversation', () => {
    expect(hasDiscussion(room([]))).toBe(false)
  })
})

describe('the conversation the Discussion shows', () => {
  const list = [conversation(1, 'finished'), conversation(2, 'finished'), conversation(3, 'active')]

  it('is the active one when the address names none', () => {
    expect(conversationToShow(list, null)).toBe(3)
  })

  it('is the latest finished one when none is active', () => {
    expect(conversationToShow(list.slice(0, 2), null)).toBe(2)
  })

  it('is the one the address names, when the room has it', () => {
    expect(conversationToShow(list, '1')).toBe(1)
  })

  it('falls back to the default for an address that names nothing real', () => {
    for (const requested of ['9', '0', '-1', 'abc', '', '2.5', '1e0']) {
      expect(conversationToShow(list, requested), requested).toBe(3)
    }
  })

  it('is nothing in a room with no conversation', () => {
    expect(conversationToShow([], null)).toBeUndefined()
    expect(conversationToShow([], '1')).toBeUndefined()
  })
})
