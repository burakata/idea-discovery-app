// The one place that knows which languages the client supports, the default and
// the fallback (docs/engineering.md section 15). Add a language here, then add its
// strings file; no other code compares language codes.
export const LANGS = ['en', 'tr'] as const

export type Lang = (typeof LANGS)[number]

// Each language is named in its own language, so these labels are not translated.
// The language switch is drawn from this, one entry per code in LANGS.
export const LANG_LABELS: Record<Lang, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  tr: { short: 'TR', full: 'Türkçe' },
}

// The source language, and the fallback for anything unsupported.
export const DEFAULT_LANG: Lang = 'en'

export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value)
}

// Phase 1 has a pair of languages, and the demo shows the other one's version
// (a translation, the other language of a proposal). With more languages this
// is the place to decide which one to show; today it is the one that is not `lang`.
export function otherLang(lang: Lang): Lang {
  return LANGS.find((l) => l !== lang) ?? DEFAULT_LANG
}
