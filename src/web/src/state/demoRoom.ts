// The demo's side of the room: pure functions on the demo state, like demoPeople.ts, so
// its rules can be tested without React. Only the demo build includes this file.
import { ApiError } from '../api/client'
import { emptyContent } from '../api/room'
import { findProject } from '../projects'
import type { ConversationSummary, MessagePage, Room, RoomMessage } from './context'
import * as peopleRules from './demoPeople'
import type { AppState, DemoConversation, Message, Room as DemoRoom } from './types'

// A sample room's Conversation 1 starts on a fixed day, so the seed stays the same.
export const SAMPLE_STARTED_AT = '2026-11-12T09:00:00.000Z'

// What the API does when Burak creates a project: Conversation 1, active, and nothing else.
export function newDemoRoom(startedAt: string): DemoRoom {
  return {
    conversations: [{ number: 1, state: 'active', startedAt, finishedAt: null, messages: [] }],
    statements: [],
    jobFlow: [],
    queue: [],
    autoReply: false,
    scriptIndex: 0,
  }
}

export const activeOf = (room: DemoRoom): DemoConversation | undefined =>
  room.conversations.find((conversation) => conversation.state === 'active')

// Messages go to the active conversation only. With none, the room is returned as it was.
export function addToActive(room: DemoRoom, message: Message): DemoRoom {
  const active = activeOf(room)
  if (!active) return room
  return {
    ...room,
    conversations: room.conversations.map((conversation) =>
      conversation === active ? { ...conversation, messages: [...conversation.messages, message] } : conversation,
    ),
  }
}

const summaryOf = ({ number, state, startedAt, finishedAt }: DemoConversation): ConversationSummary => ({
  number,
  state,
  startedAt,
  finishedAt,
})

// Throws a 404 when the project does not exist, or when the viewer is an owner who is not
// in it: the same answer for both, so a room's existence is not revealed.
export function roomOf(state: AppState, projectId: string): Room {
  const details = peopleRules.detailsOf(state, projectId)
  const viewer = state.people[state.viewAs]
  if (viewer.role === 'owner' && !details.members.some((member) => member.userId === viewer.id)) {
    throw new ApiError(404, null)
  }

  // Burak's own project starts with no content; only a sample project has any.
  const sample = findProject(projectId)
  const own = state.rooms[projectId]
  const content = emptyContent()
  if (own) {
    content.jobFlow = own.jobFlow
    content.statements = own.statements
  }
  if (sample) {
    content.understanding = sample.understanding
    content.openQuestions = sample.unclear
    content.similarBusinesses = sample.similarBusinesses
  }

  return {
    id: projectId,
    title: details.title,
    intro: details.intro,
    imageVersion: details.imageVersion,
    members: details.members.map(({ userId, displayName, role }) => ({ userId, displayName, role })),
    conversations: own ? own.conversations.map(summaryOf) : [],
    content,
  }
}

function roomOrRefuse(state: AppState, projectId: string): DemoRoom {
  roomOf(state, projectId)
  const own = state.rooms[projectId]
  if (!own) throw new ApiError(404, null)
  return own
}

export function conversationsOf(state: AppState, projectId: string): ConversationSummary[] {
  return roomOrRefuse(state, projectId).conversations.map(summaryOf)
}

// A message as the API would give it. Someone who is no longer in the project is marked as
// having left and shown with no role; the assistant is not a member, so it never "leaves".
function toRoomMessage(state: AppState, projectId: string, message: Message): RoomMessage {
  const person = state.people[message.authorId]
  const left =
    person.role !== 'assistant' &&
    !(state.members[projectId] ?? []).some((member) => member.userId === message.authorId)
  const authorRole = left ? null : person.role === 'consultant' ? 'consultant' : person.role === 'owner' ? 'owner' : 'assistant'
  return {
    id: message.id,
    authorId: message.authorId,
    authorName: person.name,
    authorRole,
    authorLeft: left,
    text: message.text,
    language: message.lang,
    translation: message.translation ?? null,
    createdAt: message.at,
    ...(message.scripted ? { tag: 'scripted' as const } : {}),
  }
}

// The cursor is the number of messages read, like the API's opaque one.
export function readMessages(state: AppState, projectId: string, number: number, cursor?: string): MessagePage {
  const conversation = roomOrRefuse(state, projectId).conversations.find((entry) => entry.number === number)
  if (!conversation) throw new ApiError(404, null)
  let after = 0
  if (cursor !== undefined) {
    const match = /^(\d+)-(\d+)$/.exec(cursor)
    if (!match || Number(match[1]) !== number) throw new ApiError(400, 'invalid_cursor')
    after = Number(match[2])
  }
  return {
    messages: conversation.messages.slice(after).map((message) => toRoomMessage(state, projectId, message)),
    cursor: `${number}-${conversation.messages.length}`,
  }
}

const MAX_TEXT_LENGTH = 4000

// Refuses like the API does: a bad text is 400 or 413, and no active conversation is 409.
// Returns the text to store.
export function checkToPost(state: AppState, projectId: string, text: string): string {
  const room = roomOrRefuse(state, projectId)
  const clean = text.trim()
  if (!clean) throw new ApiError(400, 'message_not_valid')
  if (clean.length > MAX_TEXT_LENGTH) throw new ApiError(413, null)
  if (!activeOf(room)) throw new ApiError(409, 'no_active_conversation')
  return clean
}

// The newest message of the active conversation, as the API would return it after a post.
export function lastActiveMessage(state: AppState, projectId: string): RoomMessage {
  const messages = activeOf(roomOrRefuse(state, projectId))?.messages ?? []
  return toRoomMessage(state, projectId, messages[messages.length - 1])
}

function consultantRoom(state: AppState, projectId: string): DemoRoom {
  const room = roomOrRefuse(state, projectId)
  if (state.people[state.viewAs].role !== 'consultant') throw new ApiError(403, null)
  return room
}

// Only Burak finishes the active conversation. It stays readable and nobody can write in it.
export function finishActive(state: AppState, projectId: string, now: Date): AppState {
  const room = consultantRoom(state, projectId)
  const active = activeOf(room)
  if (!active) throw new ApiError(409, 'no_active_conversation')
  const finished = { ...active, state: 'finished' as const, finishedAt: now.toISOString() }
  return {
    ...state,
    rooms: {
      ...state.rooms,
      [projectId]: {
        ...room,
        conversations: room.conversations.map((conversation) => (conversation === active ? finished : conversation)),
      },
    },
  }
}

// Only Burak starts the next one, and only when none is active. Its number is the highest + 1.
export function startNext(
  state: AppState,
  projectId: string,
  now: Date,
): { state: AppState; conversation: ConversationSummary } {
  const room = consultantRoom(state, projectId)
  if (activeOf(room)) throw new ApiError(409, 'conversation_active')
  const number = Math.max(0, ...room.conversations.map((conversation) => conversation.number)) + 1
  const started: DemoConversation = {
    number,
    state: 'active',
    startedAt: now.toISOString(),
    finishedAt: null,
    messages: [],
  }
  return {
    state: {
      ...state,
      rooms: { ...state.rooms, [projectId]: { ...room, conversations: [...room.conversations, started] } },
    },
    conversation: summaryOf(started),
  }
}
