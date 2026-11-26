import { useLocation } from 'react-router-dom'
import en, { type Strings } from './en'
import tr from './tr'
import { DEFAULT_LANG, LANG_LABELS, otherLang, type Lang } from '../languages'
import type { Text } from '../projects/types'
import { useStore } from '../state/store'
import type { Person, Written } from '../state/types'

const stringsByLang: Record<Lang, Strings> = { en, tr }

// Burak's own room screens (queue, private notes) are English only, so the
// whole screen stays in English there, whatever his language setting is.
const consultantScreen = /^\/projects\/[^/]+\/(queue|notes)\/?$/

// Burak's project form and People screen: /projects/new, /projects/<id>/edit, /projects/<id>/people.
const projectScreens = /^\/projects\/(new|[^/]+\/(edit|people))\/?$/

// Burak's project list is the home page ('/') when he is the one signed in.
export function isEnglishOnly(pathname: string, consultant = false): boolean {
  return (
    consultantScreen.test(pathname) || (consultant && (pathname === '/' || projectScreens.test(pathname)))
  )
}

export function screenLang(pathname: string, viewerLang: Lang, consultant = false): Lang {
  return isEnglishOnly(pathname, consultant) ? DEFAULT_LANG : viewerLang
}

// Puts values into a string's {placeholders}.
export function fill(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match)
}

// Text in the reader's language. "missing" means only the other language exists.
export function pickText(text: Text, lang: Lang): { text: string; missing: boolean } {
  const own = text[lang]
  if (own) return { text: own, missing: false }
  return { text: text[otherLang(lang)] ?? '', missing: true }
}

// The translation line for something written in another language. Burak decided
// (2026-11-26) that nothing is shown until a real translation exists: no placeholder.
export function translationLine(written: Written, lang: Lang, t: Strings) {
  if (written.lang === lang || !written.translation) return undefined
  return { label: t.discussion.translated, text: written.translation }
}

export function useT() {
  const { language, me } = useStore()
  const { pathname } = useLocation()
  const consultant = me?.isConsultant === true
  const englishOnly = isEnglishOnly(pathname, consultant)
  const lang = screenLang(pathname, language, consultant)
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
