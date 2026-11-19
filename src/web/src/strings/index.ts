import { useLocation } from 'react-router-dom'
import en, { type Strings } from './en'
import tr from './tr'
import type { Lang, Text } from '../projects/types'
import { useStore } from '../state/store'
import type { Person, Written } from '../state/types'

const stringsByLang: Record<Lang, Strings> = { en, tr }
const localeByLang: Record<Lang, string> = { en: 'en-GB', tr: 'tr-TR' }

// Burak's own screens (queue, private notes, rooms) are English only, so the
// whole screen stays in English there, whatever his language setting is.
const consultantScreen = /^\/rooms\/?$|\/(queue|notes)\/?$/

export function useT() {
  const { viewer } = useStore()
  const { pathname } = useLocation()
  const englishOnly = consultantScreen.test(pathname)
  const lang = englishOnly ? 'en' : viewer.language
  const t = stringsByLang[lang]
  const time = new Intl.DateTimeFormat(localeByLang[lang], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return {
    t,
    lang,
    englishOnly,
    time: (iso: string) => time.format(new Date(iso)),
    personName: (person: Person) => (person.role === 'assistant' ? t.roles.assistant : person.name),
    // Text in the reader's language. "missing" means only the other language exists.
    pick: (text: Text) => {
      const own = text[lang]
      if (own) return { text: own, missing: false }
      return { text: text[lang === 'en' ? 'tr' : 'en'] ?? '', missing: true }
    },
    // The translation line for something written in another language, if one is needed.
    translationOf: (written: Written) =>
      written.lang === lang
        ? undefined
        : {
            label: t.discussion.translated,
            text: written.translation,
            placeholder: t.discussion.translationPlaceholder,
          },
  }
}
