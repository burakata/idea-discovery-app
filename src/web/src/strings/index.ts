import { useLocation } from 'react-router-dom'
import en, { type Strings } from './en'
import tr from './tr'
import { DEFAULT_LANG, LANG_LABELS, otherLang, type Lang } from '../languages'
import type { Text } from '../projects/types'
import { useStore } from '../state/store'
import type { Person, Written } from '../state/types'

const stringsByLang: Record<Lang, Strings> = { en, tr }

// Burak's own screens (queue, private notes, rooms) are English only, so the
// whole screen stays in English there, whatever his language setting is.
const consultantScreen = /^\/rooms\/?$|\/(queue|notes)\/?$/

export function isEnglishOnly(pathname: string): boolean {
  return consultantScreen.test(pathname)
}

export function screenLang(pathname: string, viewerLang: Lang): Lang {
  return isEnglishOnly(pathname) ? DEFAULT_LANG : viewerLang
}

// Text in the reader's language. "missing" means only the other language exists.
export function pickText(text: Text, lang: Lang): { text: string; missing: boolean } {
  const own = text[lang]
  if (own) return { text: own, missing: false }
  return { text: text[otherLang(lang)] ?? '', missing: true }
}

// The translation line for something written in another language, if one is needed.
export function translationLine(written: Written, lang: Lang, t: Strings) {
  return written.lang === lang
    ? undefined
    : {
        label: t.discussion.translated,
        text: written.translation,
        placeholder: t.discussion.translationPlaceholder,
      }
}

export function useT() {
  const { language } = useStore()
  const { pathname } = useLocation()
  const englishOnly = isEnglishOnly(pathname)
  const lang = screenLang(pathname, language)
  const t = stringsByLang[lang]
  const time = new Intl.DateTimeFormat(LANG_LABELS[lang].locale, {
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
    pick: (text: Text) => pickText(text, lang),
    translationOf: (written: Written) => translationLine(written, lang, t),
  }
}
