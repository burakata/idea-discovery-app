import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import { seeds, startingViewer } from '../demo/seed'
import { scriptLine } from '../demo/script'
import { projects } from '../projects'
import type { Lang } from '../projects/types'
import type { AppState, Message, Person, QueueItem, Room } from './types'

const STORAGE_KEY = 'idea-discovery-rooms-demo'
// Raise this when the saved shape or the seed changes, so old demo data is dropped.
const VERSION = 4
const AUTO_REPLY_DELAY_MS = 1500

type Action =
  | { type: 'viewAs'; id: string }
  | { type: 'language'; lang: Lang }
  | { type: 'join'; name: string }
  | { type: 'send'; roomId: string; text: string }
  | { type: 'autoReply'; roomId: string; replyTo: string }
  | { type: 'react'; roomId: string; statementId: string; kind: 'right' | 'notRight' | null; correction?: string }
  | { type: 'approve'; roomId: string; itemId: string }
  | { type: 'reject'; roomId: string; itemId: string }
  | { type: 'editItem'; roomId: string; itemId: string; lang: Lang; text: string; what?: string }
  | { type: 'autoSwitch'; roomId: string; on: boolean }
  | { type: 'confirm'; roomId: string; statementId: string }
  | { type: 'editStatement'; roomId: string; statementId: string; text: string }
  | { type: 'removeStatement'; roomId: string; statementId: string }
  | { type: 'addStatement'; roomId: string; group: 'early' | 'open'; text: string }
  | { type: 'reset' }

function createInitialState(): AppState {
  const people: Record<string, Person> = {}
  const rooms: Record<string, Room> = {}
  for (const project of projects) {
    for (const participant of project.participants) {
      people[participant.id] ??= {
        ...participant,
        roomId: participant.role === 'owner' ? project.id : null,
      }
    }
    const seed = seeds[project.id]
    rooms[project.id] = {
      messages: seed?.messages ?? [],
      statements: project.statements.map((statement) => ({
        id: statement.id,
        group: seed?.confirmed.includes(statement.id) ? 'confirmed' : statement.group,
        text: statement.text,
        reactions: seed?.reactions[statement.id] ?? [],
      })),
      jobFlow: project.jobFlow,
      queue: seed?.queue ?? [],
      autoReply: false,
      scriptIndex: seed?.scriptIndex ?? 0,
    }
  }
  return { version: VERSION, seq: 1, viewAs: startingViewer, people, rooms }
}

function loadState(): AppState {
  let state = createInitialState()
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as AppState | null
    if (stored?.version === VERSION && projects.every((project) => stored.rooms[project.id])) {
      state = stored
    }
  } catch {
    // Unreadable demo data: start again from the seed.
  }
  // Prototype-only: ?as=burak&lang=tr sets who is viewing and in which language.
  const params = new URLSearchParams(window.location.search)
  const as = params.get('as')
  if (as && state.people[as] && state.people[as].role !== 'assistant') {
    state = { ...state, viewAs: as }
  }
  const lang = params.get('lang')
  if (lang === 'en' || lang === 'tr') {
    const viewer = state.people[state.viewAs]
    state = { ...state, people: { ...state.people, [viewer.id]: { ...viewer, language: lang } } }
  }
  return state
}

function otherLang(lang: Lang): Lang {
  return lang === 'en' ? 'tr' : 'en'
}

function updateRoom(state: AppState, roomId: string, change: (room: Room) => Room, used = 0): AppState {
  return {
    ...state,
    seq: state.seq + used,
    rooms: { ...state.rooms, [roomId]: change(state.rooms[roomId]) },
  }
}

function updateViewer(state: AppState, change: Partial<Person>): AppState {
  const viewer = state.people[state.viewAs]
  return { ...state, people: { ...state.people, [viewer.id]: { ...viewer, ...change } } }
}

function assistantMessage(id: string, lang: Lang, text: string, translation?: string): Message {
  return {
    id,
    authorId: 'assistant',
    at: new Date().toISOString(),
    lang,
    text,
    translation,
    scripted: true,
  }
}

function reducer(state: AppState, action: Action): AppState {
  const viewer = state.people[state.viewAs]

  switch (action.type) {
    case 'viewAs':
      return { ...state, viewAs: action.id }

    case 'language':
      return updateViewer(state, { language: action.lang })

    case 'join':
      return updateViewer(state, { name: action.name, joined: true })

    case 'send': {
      const message: Message = {
        id: `m${state.seq}`,
        authorId: viewer.id,
        at: new Date().toISOString(),
        lang: viewer.language,
        text: action.text,
      }
      return updateRoom(
        state,
        action.roomId,
        (room) => {
          const next = { ...room, messages: [...room.messages, message] }
          const line = scriptLine(room.scriptIndex)
          // With approval on, an owner's message produces a draft for Burak, not a reply.
          if (viewer.role !== 'owner' || room.autoReply || !line) return next
          const draft: QueueItem = {
            id: `q${state.seq + 1}`,
            kind: 'message',
            replyTo: viewer.id,
            lang: viewer.language,
            text: line[viewer.language],
            translation: line[otherLang(viewer.language)],
          }
          return { ...next, queue: [...room.queue, draft], scriptIndex: room.scriptIndex + 1 }
        },
        2,
      )
    }

    case 'autoReply':
      return updateRoom(
        state,
        action.roomId,
        (room) => {
          const line = scriptLine(room.scriptIndex)
          const lang = state.people[action.replyTo].language
          if (!room.autoReply || !line) return room
          return {
            ...room,
            messages: [
              ...room.messages,
              assistantMessage(`m${state.seq}`, lang, line[lang], line[otherLang(lang)]),
            ],
            scriptIndex: room.scriptIndex + 1,
          }
        },
        1,
      )

    case 'react':
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        statements: room.statements.map((statement) => {
          if (statement.id !== action.statementId) return statement
          const others = statement.reactions.filter((reaction) => reaction.personId !== viewer.id)
          if (!action.kind) return { ...statement, reactions: others }
          const correction = action.correction ? { lang: viewer.language, text: action.correction } : undefined
          return {
            ...statement,
            reactions: [...others, { personId: viewer.id, kind: action.kind, correction }],
          }
        }),
      }))

    case 'approve':
      return updateRoom(
        state,
        action.roomId,
        (room) => {
          const item = room.queue.find((entry) => entry.id === action.itemId)
          if (!item) return room
          const queue = room.queue.filter((entry) => entry.id !== item.id)
          if (item.kind === 'message') {
            return {
              ...room,
              queue,
              messages: [
                ...room.messages,
                assistantMessage(`m${state.seq}`, item.lang, item.text, item.translation),
              ],
            }
          }
          if (item.kind === 'statement') {
            // A replacement changes the statement it names, if that still exists: a
            // rewording keeps its group, an answered open question becomes an early
            // interpretation. Neither is ever moved to Confirmed.
            if (room.statements.some((statement) => statement.id === item.replaces)) {
              return {
                ...room,
                queue,
                statements: room.statements.map((statement) =>
                  statement.id === item.replaces
                    ? { ...statement, group: item.group, text: item.text }
                    : statement,
                ),
              }
            }
            // Approved proposals are never added as Confirmed.
            return {
              ...room,
              queue,
              statements: [
                ...room.statements,
                { id: `s${state.seq}`, group: item.group, text: item.text, reactions: [] },
              ],
            }
          }
          return {
            ...room,
            queue,
            // The known part replaces the step; what is still unknown follows it as a question.
            jobFlow: room.jobFlow.flatMap((step) => {
              if (step.id !== item.stepId) return [step]
              const known = { ...step, who: item.who, what: item.what, unknown: false }
              if (!item.stillUnknown) return [known]
              return [known, { ...step, ...item.stillUnknown, id: `${step.id}-unknown`, unknown: true }]
            }),
          }
        },
        1,
      )

    case 'reject':
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        queue: room.queue.filter((entry) => entry.id !== action.itemId),
      }))

    case 'editItem':
      // Edited text exists only in the language Burak typed it in.
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        queue: room.queue.map((item): QueueItem => {
          if (item.id !== action.itemId) return item
          if (item.kind === 'message') return { ...item, text: action.text, translation: undefined }
          if (item.kind === 'statement') return { ...item, text: { [action.lang]: action.text } }
          return {
            ...item,
            who: { [action.lang]: action.text },
            what: { [action.lang]: action.what ?? '' },
          }
        }),
      }))

    case 'autoSwitch':
      // Drafts already in the queue stay there.
      return updateRoom(state, action.roomId, (room) => ({ ...room, autoReply: action.on }))

    case 'confirm':
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        statements: room.statements.map((statement) =>
          statement.id === action.statementId ? { ...statement, group: 'confirmed' } : statement,
        ),
      }))

    case 'editStatement':
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        statements: room.statements.map((statement) =>
          statement.id === action.statementId
            ? { ...statement, text: { [viewer.language]: action.text } }
            : statement,
        ),
      }))

    case 'removeStatement':
      return updateRoom(state, action.roomId, (room) => ({
        ...room,
        statements: room.statements.filter((statement) => statement.id !== action.statementId),
      }))

    case 'addStatement':
      return updateRoom(
        state,
        action.roomId,
        (room) => ({
          ...room,
          statements: [
            ...room.statements,
            {
              id: `s${state.seq}`,
              group: action.group,
              text: { [viewer.language]: action.text },
              reactions: [],
            },
          ],
        }),
        1,
      )

    case 'reset':
      return createInitialState()
  }
}

interface Store {
  state: AppState
  viewer: Person
  dispatch: (action: Action) => void
  send: (roomId: string, text: string) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const viewer = state.people[state.viewAs]

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const send = (roomId: string, text: string) => {
    dispatch({ type: 'send', roomId, text })
    if (viewer.role === 'owner' && state.rooms[roomId].autoReply) {
      setTimeout(() => dispatch({ type: 'autoReply', roomId, replyTo: viewer.id }), AUTO_REPLY_DELAY_MS)
    }
  }

  return <StoreContext.Provider value={{ state, viewer, dispatch, send }}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
