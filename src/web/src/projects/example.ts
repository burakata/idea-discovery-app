import { assistant, burak, type Project } from './types'

// An empty project. It shows that a second idea needs only a config.
export const example: Project = {
  id: 'example',
  name: { en: 'Example project', tr: 'Örnek proje' },
  intro: {
    en: 'Each idea gets its own room. Nothing has been written for this one yet.',
    tr: 'Her fikrin kendi odası olur. Bu oda için henüz bir şey yazılmadı.',
  },
  jobFlow: [],
  understanding: [],
  unclear: [],
  similarBusinesses: [],
  participants: [burak, assistant],
  statements: [],
}
