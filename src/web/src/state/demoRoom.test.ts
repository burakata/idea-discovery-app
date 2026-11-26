import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { projects } from '../projects'
import { readMessages, roomOf } from './demoRoom'
import { createInitialState, reducer } from './demoStore'
import type { AppState } from './types'

const home = projects[0]
const example = projects[1]
const draft = { title: { en: 'Own title', tr: 'Kendi başlığım' }, intro: { en: 'Own intro', tr: 'Kendi girişim' } }

const viewingAs = (id: string): AppState => reducer(createInitialState(), { type: 'viewAs', id })

function refusal(run: () => unknown): ApiError {
  try {
    run()
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected a refusal')
}

describe('the demo room: who may open it', () => {
  it('refuses an owner who is not a member, with the same 404 as a project that does not exist', () => {
    const missing = refusal(() => roomOf(viewingAs('elif'), 'nope'))
    const notMember = refusal(() => roomOf(viewingAs('elif'), example.id))
    expect(notMember.status).toBe(404)
    expect([notMember.status, notMember.code]).toEqual([missing.status, missing.code])
  })

  it('refuses at once when View as switches to an owner who is not a member', () => {
    const asBurak = viewingAs('burak')
    expect(roomOf(asBurak, example.id).id).toBe(example.id)
    const asElif = reducer(asBurak, { type: 'viewAs', id: 'elif' })
    expect(refusal(() => roomOf(asElif, example.id)).status).toBe(404)
    // And back: Burak can open it again.
    expect(roomOf(reducer(asElif, { type: 'viewAs', id: 'burak' }), example.id).id).toBe(example.id)
  })

  it('refuses an owner who was removed from the project', () => {
    const removed = reducer(viewingAs('elif'), {
      type: 'removeMember',
      projectId: home.id,
      userId: 'elif',
      now: '2026-11-22T12:00:00Z',
    })
    expect(refusal(() => roomOf(removed, home.id)).status).toBe(404)
  })

  it('opens the room for a member, and for Burak', () => {
    expect(roomOf(viewingAs('elif'), home.id).id).toBe(home.id)
    expect(roomOf(viewingAs('burak'), home.id).id).toBe(home.id)
    expect(roomOf(viewingAs('burak'), example.id).id).toBe(example.id)
  })

  it('carries no emails: owners never see them', () => {
    const room = roomOf(viewingAs('elif'), home.id)
    expect(room.members.map((member) => member.displayName)).toContain('Elif Yıldız')
    for (const member of room.members) expect(Object.keys(member).sort()).toEqual(['displayName', 'role', 'userId'])
  })
})

describe('the demo room: what it holds', () => {
  it('gives the sample project its own texts and content', () => {
    const state = viewingAs('burak')
    const room = roomOf(state, home.id)
    expect(room.title).toEqual(home.name)
    expect(room.intro).toEqual(home.intro)
    expect(room.content.jobFlow).toEqual(state.rooms[home.id].jobFlow)
    expect(room.content.statements).toEqual(state.rooms[home.id].statements)
    expect(room.content.understanding).toEqual(home.understanding)
    expect(room.content.openQuestions).toEqual(home.unclear)
    expect(room.content.similarBusinesses).toEqual(home.similarBusinesses)
    expect(room.content.statements.length).toBeGreaterThan(0)
  })

  it('shows Burak’s edit of a sample project’s title and introduction', () => {
    const edited = reducer(viewingAs('burak'), { type: 'saveProject', id: home.id, draft })
    const room = roomOf(edited, home.id)
    expect(room.title).toEqual(draft.title)
    expect(room.intro).toEqual(draft.intro)
    // The sample's content stays.
    expect(room.content.understanding).toEqual(home.understanding)
  })

  it('has one active Conversation 1 in every room', () => {
    for (const project of projects) {
      expect(roomOf(viewingAs('burak'), project.id).conversations).toMatchObject([
        { number: 1, state: 'active', finishedAt: null },
      ])
    }
  })

  // Changed in PR 8b (was: "has no conversation in a project Burak created"). Like the API,
  // creating a project opens Conversation 1 (decision 2026-11-20), so it has a Discussion.
  it('opens Conversation 1, active and empty, in a project Burak created', () => {
    const created = reducer(viewingAs('burak'), { type: 'createProject', id: 'new-1', draft })
    const room = roomOf(created, 'new-1')
    expect(room.conversations).toMatchObject([{ number: 1, state: 'active', finishedAt: null }])
    expect(readMessages(created, 'new-1', 1).messages).toEqual([])
  })

  it('has no content at all in the second sample project', () => {
    const { content } = roomOf(viewingAs('burak'), example.id)
    for (const list of Object.values(content)) expect(list).toEqual([])
  })
})
