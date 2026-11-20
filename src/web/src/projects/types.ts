export type Lang = 'en' | 'tr'

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
  icon: 'warehouse' | 'van' | 'pallet'
  who: Text
  what: Text
  unknown: boolean
}

export interface SimilarBusiness {
  name: string
  url: string
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
  icon: 'pallet' | 'idea'
  // The hero illustration on the idea page, or null for none.
  illustration: 'warehouse' | null
  intro: {
    eyebrow: Bilingual
    title: Bilingual
    lead: Bilingual
    purpose: Bilingual[]
    notYet: Bilingual[]
  }
  jobFlow: JobFlowStep[]
  understanding: Bilingual[]
  unclear: Bilingual[]
  similarBusinesses: SimilarBusiness[]
  similarQuestion: Bilingual
  participants: Participant[]
  statements: StartingStatement[]
  // File name of the printable document in src/web/public/, per language,
  // resolved against the base URL. Missing means not ready yet.
  printVersion: Partial<Record<Lang, string>>
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
