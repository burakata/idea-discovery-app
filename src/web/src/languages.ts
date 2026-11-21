// The one place that knows which languages the client supports, the default and
// the fallback (docs/engineering.md section 15). Add a language here, then add its
// strings file; no other code compares language codes.
export const LANGS = ['en', 'tr'] as const

export type Lang = (typeof LANGS)[number]

// Each language is named in its own language, so these labels are not translated.
// The language switch is drawn from this, one entry per code in LANGS.
// `locale` is the browser locale used to format dates and times.
export const LANG_LABELS: Record<Lang, { short: string; full: string; locale: string }> = {
  en: { short: 'EN', full: 'English', locale: 'en-GB' },
  tr: { short: 'TR', full: 'Türkçe', locale: 'tr-TR' },
}

// The source language, and the fallback for anything unsupported.
export const DEFAULT_LANG: Lang = 'en'

// The language the browser prefers, if it is one we support; otherwise the default.
// Takes navigator.languages, for example ['tr-TR', 'en'].
export function browserLang(preferred: readonly string[]): Lang {
  for (const tag of preferred) {
    const primary = tag.split('-')[0].toLowerCase()
    if (isLang(primary)) return primary
  }
  return DEFAULT_LANG
}

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

// Phase 1 has a pair of languages, and the demo shows the other one's version
// (a translation, the other language of a proposal). With more languages this
// is the place to decide which one to show; today it is the one that is not `lang`.
export function otherLang(lang: Lang): Lang {
  return LANGS.find((l) => l !== lang) ?? DEFAULT_LANG
}
