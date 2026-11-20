import { describe, expect, it } from 'vitest'
import { createInitialState, reducer } from './store'
import type { AppState, JobFlowProposal } from './types'

const roomId = 'home-meals'

function withProposal(proposal: JobFlowProposal): AppState {
  const state = createInitialState()
  const room = state.rooms[roomId]
  return { ...state, rooms: { ...state.rooms, [roomId]: { ...room, queue: [proposal] } } }
}

const base: JobFlowProposal = {
  id: 'p1',
  kind: 'jobFlow',
  stepId: 'handover',
  who: { en: 'Who', tr: 'Kim' },
  what: { en: 'What', tr: 'Ne' },
}

describe('approving a job-flow proposal', () => {
  it('keeps the step a question when the proposal says it is still unknown', () => {
    const before = withProposal({ ...base, unknown: true })
    const after = reducer(before, { type: 'approve', roomId, itemId: 'p1' })
    const step = after.rooms[roomId].jobFlow.find((entry) => entry.id === 'handover')
    expect(step?.unknown).toBe(true)
    expect(after.rooms[roomId].queue).toEqual([])
    expect(after.rooms[roomId].statements).toEqual(before.rooms[roomId].statements)
    expect(after.rooms[roomId].statements.some((statement) => statement.group === 'confirmed')).toBe(false)
  })

  it('makes the step known when the proposal has no unknown flag', () => {
    const after = reducer(withProposal(base), { type: 'approve', roomId, itemId: 'p1' })
    const step = after.rooms[roomId].jobFlow.find((entry) => entry.id === 'handover')
    expect(step?.unknown).toBe(false)
  })
})
