// The rules of Burak's project form, apart from the screen so they can be tested.
// The fields come from the languages in languages.ts: one title and one
// introduction for each, so adding a language adds its fields.
import { LANG_LABELS, LANGS, type Lang } from '../languages'
import type { ProjectDraft } from '../state/context'

// The API's limits (ProjectEndpoints.MaxTitleLength and MaxIntroLength).
export const PROJECT_LIMITS = { title: 120, intro: 2000 }

export function emptyDraft(langs: readonly Lang[] = LANGS): ProjectDraft {
  const draft: ProjectDraft = { title: {} as ProjectDraft['title'], intro: {} as ProjectDraft['intro'] }
  for (const lang of langs) {
    draft.title[lang] = ''
    draft.intro[lang] = ''
  }
  return draft
}

// One group of fields for each language, named in that language.
export function formGroups(langs: readonly Lang[] = LANGS): Array<{ lang: Lang; label: string }> {
  return langs.map((lang) => ({ lang, label: LANG_LABELS[lang].full }))
}

export type FieldError = 'titleMissing' | 'titleTooLong' | 'introMissing' | 'introTooLong'

// Errors by field, "title.<lang>" or "intro.<lang>". Empty when the draft can be sent.
export function validateDraft(draft: ProjectDraft, langs: readonly Lang[] = LANGS): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {}
  for (const lang of langs) {
    const title = (draft.title[lang] ?? '').trim()
    const intro = (draft.intro[lang] ?? '').trim()
    if (!title) errors[`title.${lang}`] = 'titleMissing'
    else if (title.length > PROJECT_LIMITS.title) errors[`title.${lang}`] = 'titleTooLong'
    if (!intro) errors[`intro.${lang}`] = 'introMissing'
    else if (intro.length > PROJECT_LIMITS.intro) errors[`intro.${lang}`] = 'introTooLong'
  }
  return errors
}

// What is sent: every field trimmed.
export function cleanDraft(draft: ProjectDraft, langs: readonly Lang[] = LANGS): ProjectDraft {
  const clean = emptyDraft(langs)
  for (const lang of langs) {
    clean.title[lang] = (draft.title[lang] ?? '').trim()
    clean.intro[lang] = (draft.intro[lang] ?? '').trim()
  }
  return clean
}
