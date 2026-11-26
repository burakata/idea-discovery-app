import { describe, expect, it } from 'vitest'
import type { ConversationSummary, Room } from './context'
import { hasDiscussion, roomPath, shownConversation } from './roomRules'

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
