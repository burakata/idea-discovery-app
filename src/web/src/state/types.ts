import type { JobFlowStep, Lang, Participant, StatementGroup, Text } from '../projects/types'

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
  source: Source
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

export interface AppState {
  version: number
  seq: number
  viewAs: string
  people: Record<string, Person>
  rooms: Record<string, Room>
}
