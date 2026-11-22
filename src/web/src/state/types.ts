import type { Bilingual, JobFlowStep, Lang, Participant, StatementGroup, Text } from '../projects/types'
import type { Invitation, SignInSession } from './context'

export interface Person extends Participant {
  // The room an owner belongs to. Burak and the assistant are in every room.
  roomId: string | null
}

// Stored as written. The translation is shown beneath for other readers.
export interface Written {
  lang: Lang
  text: string
  translation?: string
}

export interface Message extends Written {
  id: string
  authorId: string
  at: string
  scripted?: boolean
}

export interface Reaction {
  personId: string
  kind: 'right' | 'notRight'
  correction?: Written
}

export interface Statement {
  id: string
  group: StatementGroup
  text: Text
  reactions: Reaction[]
}

// Who said it and the words it rests on, so Burak can check a proposal quickly.
export interface Source {
  saidBy: string
  quote: string
}

export interface MessageDraft extends Written {
  id: string
  kind: 'message'
  replyTo: string
}

export interface StatementProposal {
  id: string
  kind: 'statement'
  group: 'early' | 'open'
  text: Text
  // Set when this rewords an existing statement, or answers an open question,
  // instead of adding a new statement.
  replaces?: string
  source: Source
}

export interface JobFlowProposal {
  id: string
  kind: 'jobFlow'
  stepId: string
  who: Text
  what: Text
  // The part of the step that is still not known. It stays in the flow as a question.
  stillUnknown?: { who: Text; what: Text }
  // True when the step itself stays a question (a split into questions).
  unknown?: boolean
  // None when the change rests on what nobody has said yet.
  source?: Source
}

export type QueueItem = MessageDraft | StatementProposal | JobFlowProposal

export interface Room {
  messages: Message[]
  statements: Statement[]
  jobFlow: JobFlowStep[]
  queue: QueueItem[]
  autoReply: boolean
  // Index of the next scripted line.
  scriptIndex: number
}

// A person's place in a project (their name and role are on the person), with the
// sample email Burak's People screen shows.
export interface DemoMember {
  userId: string
  email: string
}

// The title and introduction of a project Burak created, or his edit of a sample one.
export interface DemoTexts {
  title: Bilingual
  intro: Bilingual
}

export interface AppState {
  version: number
  seq: number
  // The demo opens signed out. "Try the demo" signs in as Burak.
  signedIn: boolean
  // The signed-out visitor's language choice.
  guestLanguage: Lang
  viewAs: string
  people: Record<string, Person>
  rooms: Record<string, Room>
  // Burak's project and people screens. Projects he creates in the demo have no room.
  created: string[]
  texts: Record<string, DemoTexts>
  members: Record<string, DemoMember[]>
  invitations: Record<string, Invitation[]>
  // Invented sample sign-ins, by person.
  sessions: Record<string, SignInSession[]>
}
