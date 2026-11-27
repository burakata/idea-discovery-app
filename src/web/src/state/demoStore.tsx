// The demo data source: seed data and a simulated sign-in, saved in local storage.
// Only the demo build includes this file (see App.tsx and store.tsx).
import { createContext, useContext, useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { seeds, startingViewer } from '../demo/seed'
import { scriptLine } from '../demo/script'
import { projects } from '../projects'
import { DEFAULT_LANG, isLang, otherLang, type Lang } from '../languages'
import { ApiError } from '../api/client'
import {
  StoreContext,
  type InviteInput,
  type JoinInput,
  type Me,
  type NoticeKey,
  type ProjectCard,
  type ProjectDraft,
  type Store,
} from './context'
import { browserClipboard, copyLink } from './copyLink'
import * as imageRules from './demoImage'
import * as joinRules from './demoJoin'
import * as peopleRules from './demoPeople'
import * as roomRules from './demoRoom'
import type { AppState, Message, Person, QueueItem, Room } from './types'

const STORAGE_KEY = 'idea-discovery-rooms-demo'
// Raise this when the saved shape or the seed changes, so old demo data is dropped.
const VERSION = 10
const AUTO_REPLY_DELAY_MS = 1500

type Action =
  | { type: 'signIn'; language?: Lang }
  | { type: 'signOut' }
  | { type: 'guestLanguage'; lang: Lang }
  | { type: 'viewAs'; id: string }
  | { type: 'language'; lang: Lang }
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
  | { type: 'finishConversation'; roomId: string; now: string }
  | { type: 'startConversation'; roomId: string; now: string }
  | { type: 'createProject'; id: string; draft: ProjectDraft; now?: string }
  | { type: 'saveProject'; id: string; draft: ProjectDraft }
  | { type: 'setImage'; projectId: string; dataUrl: string }
  | { type: 'removeImage'; projectId: string }
  | { type: 'invite'; projectId: string; input: InviteInput; now: string }
  | { type: 'revokeInvitation'; invitationId: string }
  | { type: 'endSession'; sessionId: string; now: string }
  | { type: 'removeMember'; projectId: string; userId: string; now: string }
  | { type: 'joinOn'; projectId: string }
  | { type: 'joinOff'; projectId: string }
  | { type: 'joinRenew'; projectId: string }
  | { type: 'joinAsk'; code: string; input: JoinInput; device: string; now: string }
  | { type: 'joinApprove'; requestId: string; displayName?: string; now: string }
  | { type: 'joinReject'; requestId: string; now: string }
  | { type: 'joinClaim'; now: string }
  | { type: 'reset' }

export function createInitialState(): AppState {
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
      conversations: [
        {
          number: 1,
          state: 'active',
          startedAt: roomRules.SAMPLE_STARTED_AT,
          finishedAt: null,
          messages: seed?.messages ?? [],
        },
      ],
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
  // The demo opens on the signed-out home, like the real app.
  return {
    version: VERSION,
    seq: 1,
    signedIn: false,
    guestLanguage: DEFAULT_LANG,
    viewAs: startingViewer,
    people,
    rooms,
    ...peopleRules.initialPeopleState(people),
  }
}

// Saves the demo state. False when the browser refuses (a full quota): the demo keeps
// working from memory, and nothing throws.
export function saveState(state: AppState, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
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
  // Prototype-only: ?as=burak&lang=tr sets who is viewing (signed in) and in which language.
  const params = new URLSearchParams(window.location.search)
  const as = params.get('as')
  if (as && state.people[as] && state.people[as].role !== 'assistant') {
    state = { ...state, viewAs: as, signedIn: true }
  }
  const lang = params.get('lang')
  if (isLang(lang)) {
    const viewer = state.people[state.viewAs]
    state = {
      ...state,
      guestLanguage: lang,
      people: { ...state.people, [viewer.id]: { ...viewer, language: lang } },
    }
  }
  return state
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

function attempt(state: AppState, change: () => AppState): AppState {
  try {
    return change()
  } catch (failure) {
    if (failure instanceof ApiError) return state
    throw failure
  }
}

export function reducer(state: AppState, action: Action): AppState {
  const viewer = state.people[state.viewAs]

  switch (action.type) {
    case 'signIn': {
      // The simulated sign-in is always as the sample consultant.
      const consultant = state.people[startingViewer]
      const language = action.language ?? consultant.language
      return {
        ...state,
        signedIn: true,
        viewAs: consultant.id,
        guestLanguage: language,
        people: { ...state.people, [consultant.id]: { ...consultant, language } },
      }
    }

    case 'signOut':
      // The person's language carries over to the signed-out home.
      return { ...state, signedIn: false, guestLanguage: viewer.language }

    case 'guestLanguage':
      return { ...state, guestLanguage: action.lang }

    case 'viewAs':
      return { ...state, viewAs: action.id }

    case 'language':
      return updateViewer(state, { language: action.lang })

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
          // With no active conversation there is nowhere to write: nothing changes.
          if (!roomRules.activeOf(room)) return room
          const next = roomRules.addToActive(room, message)
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
          if (!room.autoReply || !line || !roomRules.activeOf(room)) return room
          return {
            ...roomRules.addToActive(
              room,
              assistantMessage(`m${state.seq}`, lang, line[lang], line[otherLang(lang)]),
            ),
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
            // The draft waits while no conversation is active: Burak can still reject it.
            if (!roomRules.activeOf(room)) return room
            return {
              ...roomRules.addToActive(room, assistantMessage(`m${state.seq}`, item.lang, item.text, item.translation)),
              queue,
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
              const known = { ...step, who: item.who, what: item.what, unknown: item.unknown ?? false }
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

    // The store has already run each of these once and let a refusal through to the
    // screen, so a refusal here cannot happen; the state stays as it was if it does.
    case 'createProject': {
      // Like the API: creating a project opens Conversation 1, with nothing in it yet.
      const created = peopleRules.createProject(state, action.id, action.draft)
      const startedAt = action.now ?? new Date().toISOString()
      return { ...created, rooms: { ...created.rooms, [action.id]: roomRules.newDemoRoom(startedAt) } }
    }

    case 'finishConversation':
      return attempt(state, () => roomRules.finishActive(state, action.roomId, new Date(action.now)))

    case 'startConversation':
      return attempt(state, () => roomRules.startNext(state, action.roomId, new Date(action.now)).state)

    case 'saveProject':
      return peopleRules.saveProject(state, action.id, action.draft)

    case 'setImage':
      return imageRules.setImage(state, action.projectId, action.dataUrl)

    case 'removeImage':
      return imageRules.removeImage(state, action.projectId)

    case 'invite':
      return attempt(state, () => peopleRules.invite(state, action.projectId, action.input, new Date(action.now)).state)

    case 'revokeInvitation':
      return attempt(state, () => peopleRules.revokeInvitation(state, action.invitationId))

    case 'endSession':
      return attempt(state, () => peopleRules.endSession(state, action.sessionId, new Date(action.now)))

    case 'removeMember':
      return attempt(state, () =>
        peopleRules.removeMember(state, action.projectId, action.userId, new Date(action.now)),
      )

    case 'joinOn':
      return attempt(state, () => joinRules.turnOn(state, action.projectId))

    case 'joinOff':
      return attempt(state, () => joinRules.turnOff(state, action.projectId))

    case 'joinRenew':
      return attempt(state, () => joinRules.renew(state, action.projectId))

    case 'joinAsk':
      return attempt(
        state,
        () => joinRules.ask(state, action.code, action.input, action.device, new Date(action.now)).state,
      )

    case 'joinApprove':
      return attempt(
        state,
        () => joinRules.approve(state, action.requestId, action.displayName, new Date(action.now)).state,
      )

    case 'joinReject':
      return attempt(state, () => joinRules.reject(state, action.requestId, new Date(action.now)))

    case 'joinClaim':
      return attempt(state, () => joinRules.claim(state, new Date(action.now)))

    case 'reset':
      return createInitialState()
  }
}

// What the demo-only room screens use (queue, notes and the summary's actions).
interface DemoStore {
  state: AppState
  viewer: Person
  dispatch: (action: Action) => void
}

const DemoContext = createContext<DemoStore | null>(null)

function cardsFor(state: AppState, viewer: Person): ProjectCard[] {
  // Owners see the projects they are in, even if there is one; Burak sees all.
  return peopleRules
    .projectIds(state)
    .filter(
      (id) =>
        viewer.role === 'consultant' || (state.members[id] ?? []).some((member) => member.userId === viewer.id),
    )
    .map((id) => {
      const texts = peopleRules.textsOf(state, id)!
      return { id, title: texts.title, lead: texts.intro }
    })
}

// Burak's screens on the demo data. Nothing is sent; links are samples. Each action
// works out the next state with its pure function (which throws the refusal), keeps
// it in `latest` and then dispatches, and the reads use `latest`: a render's own
// state would still be the old one right after a change.
export function createConsultantActions(
  latest: { current: AppState },
  dispatch: (action: Action) => void,
  clipboard = browserClipboard,
  // Where the demo's own pages live, so a copied sample link opens the demo's ask-to-join page.
  linkBase = '',
  device = '',
  // Where the demo saves itself; a test passes one that is full.
  storage?: Pick<Storage, 'setItem'>,
) {
  const apply = (action: Action) => {
    latest.current = reducer(latest.current, action)
    dispatch(action)
  }
  const actions: Pick<
    Store,
    | 'createProject'
    | 'saveProject'
    | 'getProject'
    | 'uploadProjectImage'
    | 'removeProjectImage'
    | 'projectImageUrl'
    | 'invite'
    | 'listInvitations'
    | 'revokeInvitation'
    | 'copyInvitationLink'
    | 'copySignInLink'
    | 'listSessions'
    | 'endSession'
    | 'removeMember'
    | 'joinCanAsk'
    | 'joinAsk'
    | 'joinStatus'
    | 'joinContinue'
    | 'joinAsking'
    | 'turnOnJoinLink'
    | 'turnOffJoinLink'
    | 'renewJoinLink'
    | 'listJoinRequests'
    | 'approveJoinRequest'
    | 'rejectJoinRequest'
  > = {
    createProject: async (draft) => {
      const id = peopleRules.newProjectId(latest.current)
      apply({ type: 'createProject', id, draft, now: new Date().toISOString() })
      return id
    },
    saveProject: async (id, draft) => {
      if (!peopleRules.textsOf(latest.current, id)) throw new ApiError(404, null)
      apply({ type: 'saveProject', id, draft })
    },
    getProject: async (id) => peopleRules.detailsOf(latest.current, id),
    uploadProjectImage: async (projectId, file) => {
      if (!peopleRules.textsOf(latest.current, projectId)) throw new ApiError(404, null)
      // The size is checked before the file is read, as the API does.
      if (file.size > imageRules.DEMO_IMAGE_MAX_BYTES) throw new ApiError(413, null)
      const bytes = new Uint8Array(await file.arrayBuffer())
      const type = imageRules.checkImage(bytes)
      const action: Action = { type: 'setImage', projectId, dataUrl: imageRules.toDataUrl(bytes, type) }
      // An image that does not fit in the browser's storage is refused, and nothing changes.
      if (!saveState(reducer(latest.current, action), storage)) throw new ApiError(413, null)
      apply(action)
      return imageRules.imageVersionOf(latest.current, projectId)!
    },
    removeProjectImage: async (projectId) => {
      if (!peopleRules.textsOf(latest.current, projectId)) throw new ApiError(404, null)
      apply({ type: 'removeImage', projectId })
    },
    projectImageUrl: (projectId, version) => imageRules.imageUrlOf(latest.current, projectId, version),
    invite: async (projectId, input) => {
      const now = new Date()
      const { outcome } = peopleRules.invite(latest.current, projectId, input, now)
      apply({ type: 'invite', projectId, input, now: now.toISOString() })
      return outcome
    },
    listInvitations: async (projectId) => peopleRules.invitationsOf(latest.current, projectId),
    revokeInvitation: async (invitationId) => {
      peopleRules.revokeInvitation(latest.current, invitationId)
      apply({ type: 'revokeInvitation', invitationId })
    },
    copyInvitationLink: async (invitationId) => {
      peopleRules.checkInvitationOpen(latest.current, invitationId)
      return copyLink(async () => peopleRules.SAMPLE_LINK, clipboard())
    },
    copySignInLink: async (userId) => {
      peopleRules.sessionsOf(latest.current, userId)
      return copyLink(async () => peopleRules.SAMPLE_LINK, clipboard())
    },
    listSessions: async (userId) => peopleRules.sessionsOf(latest.current, userId),
    endSession: async (sessionId) => {
      const now = new Date()
      peopleRules.endSession(latest.current, sessionId, now)
      apply({ type: 'endSession', sessionId, now: now.toISOString() })
    },
    removeMember: async (projectId, userId) => {
      const now = new Date()
      peopleRules.removeMember(latest.current, projectId, userId, now)
      apply({ type: 'removeMember', projectId, userId, now: now.toISOString() })
    },

    // Ask to join, both sides, on the demo data. The link is built when copied and
    // goes to the clipboard only; the state keeps the code, never the link.
    joinCanAsk: async (code) => joinRules.canAsk(latest.current, code),
    joinAsk: async (code, input) => {
      const now = new Date()
      const { status } = joinRules.ask(latest.current, code, input, device, now)
      apply({ type: 'joinAsk', code, input, device, now: now.toISOString() })
      return status
    },
    joinStatus: async (code) => joinRules.statusOf(latest.current, new Date(), code),
    joinContinue: async () => {
      const now = new Date()
      joinRules.claim(latest.current, now)
      apply({ type: 'joinClaim', now: now.toISOString() })
    },
    joinAsking: async (projectId) => {
      peopleRules.detailsOf(latest.current, projectId)
      return joinRules.isAsking(latest.current, projectId)
    },
    turnOnJoinLink: async (projectId) => {
      joinRules.turnOn(latest.current, projectId)
      apply({ type: 'joinOn', projectId })
      return copyLink(async () => joinRules.joinLink(latest.current, projectId, linkBase), clipboard())
    },
    turnOffJoinLink: async (projectId) => {
      joinRules.turnOff(latest.current, projectId)
      apply({ type: 'joinOff', projectId })
    },
    renewJoinLink: async (projectId) => {
      joinRules.renew(latest.current, projectId)
      apply({ type: 'joinRenew', projectId })
      return copyLink(async () => joinRules.joinLink(latest.current, projectId, linkBase), clipboard())
    },
    listJoinRequests: async (projectId) => joinRules.listRequests(latest.current, projectId, new Date()),
    approveJoinRequest: async (requestId, displayName) => {
      const now = new Date()
      const { displayName: name } = joinRules.approve(latest.current, requestId, displayName, now)
      apply({ type: 'joinApprove', requestId, displayName, now: now.toISOString() })
      return name
    },
    rejectJoinRequest: async (requestId) => {
      const now = new Date()
      joinRules.reject(latest.current, requestId, now)
      apply({ type: 'joinReject', requestId, now: now.toISOString() })
    },
  }
  return actions
}

// The discussion on the demo data, the same calls as the API's. A refusal is the same
// ApiError the API would give. Sending also runs the scripted assistant: a draft for Burak, or
// with automatic replies on, a reply after a short wait (`later` is injected for tests).
export function createRoomActions(
  latest: { current: AppState },
  dispatch: (action: Action) => void,
  later: (run: () => void, ms: number) => void = (run, ms) => void setTimeout(run, ms),
) {
  const apply = (action: Action) => {
    latest.current = reducer(latest.current, action)
    dispatch(action)
  }
  const actions: Pick<
    Store,
    'listConversations' | 'readMessages' | 'postMessage' | 'finishConversation' | 'startConversation'
  > = {
    listConversations: async (projectId) => roomRules.conversationsOf(latest.current, projectId),
    readMessages: async (projectId, number, cursor) =>
      roomRules.readMessages(latest.current, projectId, number, cursor),
    postMessage: async (projectId, number, text) => {
      const clean = roomRules.checkToPost(latest.current, projectId, number, text)
      const writer = latest.current.people[latest.current.viewAs]
      apply({ type: 'send', roomId: projectId, text: clean })
      if (writer.role === 'owner' && latest.current.rooms[projectId].autoReply) {
        later(() => apply({ type: 'autoReply', roomId: projectId, replyTo: writer.id }), AUTO_REPLY_DELAY_MS)
      }
      return roomRules.lastActiveMessage(latest.current, projectId)
    },
    finishConversation: async (projectId) => {
      const now = new Date()
      roomRules.finishActive(latest.current, projectId, now)
      apply({ type: 'finishConversation', roomId: projectId, now: now.toISOString() })
    },
    startConversation: async (projectId) => {
      const now = new Date()
      const { conversation } = roomRules.startNext(latest.current, projectId, now)
      apply({ type: 'startConversation', roomId: projectId, now: now.toISOString() })
      return conversation
    },
  }
  return actions
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  // The one message the demo can leave on the list: a room that could not be opened.
  const [notice, setNotice] = useState<NoticeKey | null>(null)
  const viewer = state.people[state.viewAs]
  // The newest state, kept in step with every change the people actions make, so
  // a read right after a change sees it without waiting for a new render.
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    saveState(state)
  }, [state])

  const me: Me | null = state.signedIn
    ? { id: viewer.id, displayName: viewer.name, uiLanguage: viewer.language, isConsultant: viewer.role === 'consultant' }
    : null

  const store: Store = {
    status: state.signedIn ? 'signedIn' : 'signedOut',
    me,
    language: state.signedIn ? viewer.language : state.guestLanguage,
    setLanguage: (lang) => dispatch(state.signedIn ? { type: 'language', lang } : { type: 'guestLanguage', lang }),
    projects: state.signedIn ? cardsFor(state, viewer) : null,
    projectsError: null,
    notice,
    actionError: null,
    // No email is sent in the demo; the screen says so.
    requestLink: async () => {},
    redeem: async (_token, chosenLanguage) => {
      setNotice(null)
      dispatch({ type: 'signIn', language: chosenLanguage ?? undefined })
    },
    signOut: async () => {
      setNotice(null)
      dispatch({ type: 'signOut' })
    },
    demoSignIn: () => {
      setNotice(null)
      dispatch({ type: 'signIn', language: state.guestLanguage })
    },
    // A refusal leaves the same "project gone" notice on the list as the api build does.
    loadRoom: async (projectId) => {
      try {
        const room = roomRules.roomOf(latest.current, projectId)
        setNotice(null)
        return room
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 404) setNotice('projectGone')
        throw failure
      }
    },

    ...createRoomActions(latest, dispatch),
    ...createConsultantActions(
      latest,
      dispatch,
      browserClipboard,
      window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, ''),
      window.navigator.userAgent,
    ),
  }

  return (
    <StoreContext.Provider value={store}>
      <DemoContext.Provider value={{ state, viewer, dispatch }}>{children}</DemoContext.Provider>
    </StoreContext.Provider>
  )
}

export function useDemoStore(): DemoStore {
  const store = useContext(DemoContext)
  if (!store) throw new Error('useDemoStore must be used inside the demo StoreProvider')
  return store
}
