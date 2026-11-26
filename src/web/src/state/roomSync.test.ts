import { describe, expect, it } from 'vitest'
import type { ConversationSummary } from './context'
import { sameConversations } from './roomSync'

const c = (number: number, state: ConversationSummary['state']): ConversationSummary => ({
  number,
  state,
  startedAt: '2026-11-10T10:00:00Z',
  finishedAt: state === 'finished' ? '2026-11-19T10:00:00Z' : null,
})

describe('whether a polled list changes the room', () => {
  it('is the same list when nothing changed, so a quiet poll reloads nothing', () => {
    expect(sameConversations([c(1, 'active')], [c(1, 'active')])).toBe(true)
  })
  it('differs when a conversation finished or a new one started', () => {
    expect(sameConversations([c(1, 'active')], [c(1, 'finished')])).toBe(false)
    expect(sameConversations([c(1, 'finished')], [c(1, 'finished'), c(2, 'active')])).toBe(false)
  })
})
