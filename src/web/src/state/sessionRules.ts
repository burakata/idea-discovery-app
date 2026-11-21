import type { Lang } from '../languages'

// A language chosen on the sign-in page, before pressing "Sign in", is saved to
// the person's account. If they did not touch the switch, or chose the language
// the account already has, nothing is saved and the account's language stays.
export function languageToSave(chosen: Lang | null, accountLanguage: Lang): Lang | null {
  return chosen !== null && chosen !== accountLanguage ? chosen : null
}
