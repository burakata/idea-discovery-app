import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { projects } from '../projects'
import { createRoomActions, createConsultantActions, createInitialState, reducer } from './demoStore'
import { roomOf } from './demoRoom'
import { conversationControls } from './roomRules'
import type { AppState } from './types'

const home = projects[0]
const draft = { title: { en: 'Garden', tr: 'Bahçe' }, intro: { en: 'Plots', tr: 'Parseller' } }

// The demo's discussion as a screen would use it: Burak or an owner, on the state in `latest`.
function demoAs(viewer: string, state: AppState = createInitialState()) {
  const latest = { current: reducer(state, { type: 'viewAs', id: viewer }) }
  const dispatch = () => {}
  const later: (run: () => void, ms: number) => void = (run) => run()
  return {
    latest,
    room: createRoomActions(latest, dispatch, later),
    projects: createConsultantActions(latest, dispatch, () => undefined),
  }
}

async function refusal(run: Promise<unknown>): Promise<ApiError> {
  try {
    await run
  } catch (failure) {
    if (failure instanceof ApiError) return failure
  }
  throw new Error('expected a refusal')
}

const heldBy = async (demo: ReturnType<typeof demoAs>, number: number) =>
  (await demo.room.readMessages(home.id, number)).messages

describe('the demo discussion: writing', () => {
  it('puts a sent message in the active conversation, under the writer’s own name and role', async () => {
    const demo = demoAs('elif')
    const before = (await heldBy(demo, 1)).length
    const sent = await demo.room.postMessage(home.id, '  Merhaba  ')
    expect(sent).toMatchObject({
      authorId: 'elif',
      authorName: 'Elif Yıldız',
      authorRole: 'owner',
      authorLeft: false,
      text: 'Merhaba',
      language: 'tr',
      translation: null,
    })
    const after = await heldBy(demo, 1)
    expect(after).toHaveLength(before + 1)
    expect(after.at(-1)).toEqual(sent)
  })

  it('writes into the newest conversation after Burak finishes one and starts the next', async () => {
    const demo = demoAs('burak')
    await demo.room.finishConversation(home.id)
    await demo.room.startConversation(home.id)
    const sent = await demo.room.postMessage(home.id, 'A fresh start')
    expect((await heldBy(demo, 2)).map((message) => message.id)).toEqual([sent.id])
    // The first conversation did not change.
    expect((await heldBy(demo, 1)).some((message) => message.id === sent.id)).toBe(false)
  })

  it('refuses an empty message and a message that is too long', async () => {
    const demo = demoAs('elif')
    expect((await refusal(demo.room.postMessage(home.id, '   '))).status).toBe(400)
    expect((await refusal(demo.room.postMessage(home.id, 'x'.repeat(4001)))).status).toBe(413)
  })

  it('refuses someone who is not in the project, like a project that does not exist', async () => {
    const missing = await refusal(demoAs('elif').room.postMessage('nope', 'Hi'))
    const notMember = await refusal(demoAs('elif').room.postMessage(projects[1].id, 'Hi'))
    expect([notMember.status, notMember.code]).toEqual([missing.status, missing.code])
    expect(notMember.status).toBe(404)
    expect((await refusal(demoAs('elif').room.readMessages(projects[1].id, 1))).status).toBe(404)
  })

  it('has the scripted assistant answer an owner with a draft for Burak, not a message', async () => {
    const demo = demoAs('elif')
    const queued = demo.latest.current.rooms[home.id].queue.length
    const messages = (await heldBy(demo, 1)).length
    await demo.room.postMessage(home.id, 'Hello')
    expect(demo.latest.current.rooms[home.id].queue.length).toBe(queued + 1)
    expect(await heldBy(demo, 1)).toHaveLength(messages + 1)
  })
})

describe('the demo discussion: finishing and starting', () => {
  it('makes a finished conversation read-only for everyone, and keeps it readable', async () => {
    const demo = demoAs('burak')
    const messages = await heldBy(demo, 1)
    await demo.room.finishConversation(home.id)

    const room = roomOf(demo.latest.current, home.id)
    expect(room.conversations).toMatchObject([{ number: 1, state: 'finished' }])
    expect(room.conversations[0].finishedAt).toEqual(expect.any(String))
    expect(conversationControls({ isConsultant: true }, room, 1).canWrite).toBe(false)
    expect(conversationControls({ isConsultant: false }, room, 1).canWrite).toBe(false)
    expect(await heldBy(demo, 1)).toEqual(messages)

    // The server-side rule: nothing can be written, however the screen is used.
    const owner = demoAs('elif', demo.latest.current)
    const refused = await refusal(owner.room.postMessage(home.id, 'Too late'))
    expect([refused.status, refused.code]).toEqual([409, 'no_active_conversation'])
    expect(refused.key).toBe('conversationFinished')
    expect(await heldBy(owner, 1)).toEqual(messages)
  })

  it('starts the next conversation with number + 1, active and empty', async () => {
    const demo = demoAs('burak')
    await demo.room.finishConversation(home.id)
    const started = await demo.room.startConversation(home.id)
    expect(started).toMatchObject({ number: 2, state: 'active', finishedAt: null })
    expect(await heldBy(demo, 2)).toEqual([])
    await demo.room.finishConversation(home.id)
    expect((await demo.room.startConversation(home.id)).number).toBe(3)
    expect((await demo.room.listConversations(home.id)).map((entry) => entry.number)).toEqual([1, 2, 3])
  })

  it('does not start a conversation while one is active, nor finish when none is', async () => {
    const demo = demoAs('burak')
    expect((await refusal(demo.room.startConversation(home.id))).code).toBe('conversation_active')
    await demo.room.finishConversation(home.id)
    expect((await refusal(demo.room.finishConversation(home.id))).code).toBe('no_active_conversation')
  })

  it('lets only Burak finish or start: an owner is refused and nothing changes', async () => {
    const owner = demoAs('elif')
    expect((await refusal(owner.room.finishConversation(home.id))).status).toBe(403)
    expect(roomOf(owner.latest.current, home.id).conversations[0].state).toBe('active')

    const finished = demoAs('burak')
    await finished.room.finishConversation(home.id)
    const ownerAfter = demoAs('elif', finished.latest.current)
    expect((await refusal(ownerAfter.room.startConversation(home.id))).status).toBe(403)
    expect(roomOf(ownerAfter.latest.current, home.id).conversations).toHaveLength(1)
  })

  it('does not approve a draft message into a finished conversation', async () => {
    const demo = demoAs('burak')
    const item = demo.latest.current.rooms[home.id].queue.find((entry) => entry.kind === 'message')!
    await demo.room.finishConversation(home.id)
    const after = reducer(demo.latest.current, { type: 'approve', roomId: home.id, itemId: item.id })
    expect(after.rooms[home.id].conversations[0].messages).toEqual(demo.latest.current.rooms[home.id].conversations[0].messages)
    expect(after.rooms[home.id].queue.some((entry) => entry.id === item.id)).toBe(true)
  })
})

describe('the demo discussion: messages and readers', () => {
  it('reads from a cursor and returns only what follows, like the API', async () => {
    const demo = demoAs('elif')
    const first = await demo.room.readMessages(home.id, 1)
    expect((await demo.room.readMessages(home.id, 1, first.cursor)).messages).toEqual([])
    const sent = await demo.room.postMessage(home.id, 'One more')
    const next = await demo.room.readMessages(home.id, 1, first.cursor)
    expect(next.messages).toEqual([sent])
    expect((await refusal(demo.room.readMessages(home.id, 1, 'garbage'))).status).toBe(400)
    expect((await refusal(demo.room.readMessages(home.id, 9))).status).toBe(404)
  })

  it('keeps the seeded messages as they were, with the assistant marked as scripted and no role', async () => {
    const demo = demoAs('burak')
    const messages = await heldBy(demo, 1)
    expect(messages).toHaveLength(10)
    const [opening, elif] = messages
    expect(opening).toMatchObject({ authorId: 'assistant', authorRole: 'assistant', tag: 'scripted' })
    expect(elif).toMatchObject({ authorId: 'elif', authorRole: 'owner', language: 'tr' })
    expect(elif.text).toBe(
      'Merhaba. Kısaca şöyle: evde yemek yapan insanların yemeklerini komşularına satabilmesini istiyoruz.',
    )
    expect(elif.tag).toBeUndefined()
  })

  it('marks a writer who was removed from the project as having left, with no role', async () => {
    const removed = reducer(createInitialState(), {
      type: 'removeMember',
      projectId: home.id,
      userId: 'elif',
      now: '2026-11-22T12:00:00Z',
    })
    const burak = demoAs('burak', removed)
    const hers = (await heldBy(burak, 1)).filter((message) => message.authorId === 'elif')
    expect(hers.length).toBeGreaterThan(0)
    for (const message of hers) expect(message).toMatchObject({ authorLeft: true, authorRole: null })
    const toms = (await heldBy(burak, 1)).filter((message) => message.authorId === 'tom')
    for (const message of toms) expect(message).toMatchObject({ authorLeft: false, authorRole: 'owner' })
  })
})

describe('a project Burak creates in the demo', () => {
  it('opens Conversation 1, active and empty, and can be written in at once', async () => {
    const demo = demoAs('burak')
    const id = await demo.projects.createProject(draft)
    expect(await demo.room.listConversations(id)).toMatchObject([{ number: 1, state: 'active', finishedAt: null }])
    expect((await demo.room.readMessages(id, 1)).messages).toEqual([])
    const sent = await demo.room.postMessage(id, 'First words')
    expect(sent).toMatchObject({ authorId: 'burak', authorRole: 'consultant' })
    expect((await demo.room.readMessages(id, 1)).messages).toEqual([sent])
  })
})
