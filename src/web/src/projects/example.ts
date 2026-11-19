import { assistant, burak, type Project } from './types'

// An empty project. It shows that a second idea needs only a config.
export const example: Project = {
  id: 'example',
  name: { en: 'Example project', tr: 'Örnek proje' },
  status: { en: 'Not started', tr: 'Başlamadı' },
  icon: 'idea',
  illustration: null,
  intro: {
    eyebrow: { en: 'Example', tr: 'Örnek' },
    title: { en: 'A second room, still empty.', tr: 'İkinci bir oda, henüz boş.' },
    lead: {
      en: 'Each idea gets its own room. Nothing has been written for this one yet.',
      tr: 'Her fikrin kendi odası olur. Bu oda için henüz bir şey yazılmadı.',
    },
    purpose: [],
    notYet: [],
  },
  jobFlow: [],
  understanding: [],
  unclear: [],
  similarBusinesses: [],
  similarQuestion: { en: '', tr: '' },
  participants: [burak, assistant],
  statements: [],
  printVersion: {},
}
