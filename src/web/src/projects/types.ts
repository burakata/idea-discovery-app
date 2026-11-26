import type { Lang } from '../languages'

export type { Lang }

// Project content always has both languages.
export type Bilingual = Record<Lang, string>

// Text typed during the demo exists in one language only.
export type Text = Partial<Bilingual>

export type Role = 'owner' | 'consultant' | 'assistant'
export type StatementGroup = 'confirmed' | 'early' | 'open'

export interface Participant {
  id: string
  role: Role
  name: string
  language: Lang
  joined: boolean
}

export interface JobFlowStep {
  id: string
  icon: 'people' | 'discussion' | 'send' | 'check'
  who: Text
  what: Text
  unknown: boolean
}

export interface SimilarBusiness {
  name: Bilingual
  // Optional: invented example descriptions have no website.
  url?: string
  how: Bilingual
}

export interface StartingStatement {
  id: string
  group: 'early' | 'open'
  text: Bilingual
}

// One project (idea) is one config. No project text lives inside components.
export interface Project {
  id: string
  name: Bilingual
  status: Bilingual
  // Shown beside the project's name in the sidebar and the rooms list.
  icon: 'idea'
  // What this is for and what is not done yet are the app's own text (strings/), not the project's.
  intro: {
    title: Bilingual
    lead: Bilingual
  }
  jobFlow: JobFlowStep[]
  understanding: Bilingual[]
  unclear: Bilingual[]
  similarBusinesses: SimilarBusiness[]
  participants: Participant[]
  statements: StartingStatement[]
}

export const burak: Participant = {
  id: 'burak',
  role: 'consultant',
  name: 'Burak',
  language: 'en',
  joined: true,
}

// The assistant's display name comes from the strings files.
export const assistant: Participant = {
  id: 'assistant',
  role: 'assistant',
  name: '',
  language: 'en',
  joined: true,
}
