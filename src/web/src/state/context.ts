import { createContext, useContext } from 'react'
import type { ErrorKey } from '../api/client'
import type { Lang } from '../languages'
import type { Text } from '../projects/types'

// Who is signed in. The same in both builds.
export interface Me {
  id: string
  displayName: string
  uiLanguage: Lang
  isConsultant: boolean
}

export type SessionStatus = 'checking' | 'signedOut' | 'signedIn'

// A neutral message shown on the home or the list after the app moved the person there.
export type NoticeKey = 'signedOut' | 'signedOutByYou' | 'projectGone'

// One project in the person's list. `to` is set where the project can be opened.
export interface ProjectCard {
  id: string
  title: Text
  lead?: Text
  to?: string
}

// What every screen sees. Two implementations sit behind it: the demo (seed data,
// local storage, simulated sign-in) and the API. Screens never know which.
export interface Store {
  status: SessionStatus
  me: Me | null
  // The language the app shows: the account's when signed in, the visitor's choice otherwise.
  language: Lang
  setLanguage: (lang: Lang) => void
  // The projects the signed-in person belongs to; null until they have loaded.
  projects: ProjectCard[] | null
  // Set when the list could not be loaded, so the screen does not claim there are no projects.
  projectsError: ErrorKey | null
  // Kept until the next sign-in, sign-out or list reload.
  notice: NoticeKey | null
  // An action that failed and left the person where they were, such as a sign-out that did not go through.
  actionError: ErrorKey | null
  // Never fails and never says whether the email is known.
  requestLink: (email: string) => Promise<void>
  // Uses the link's token once. Throws an ApiError when the link does not work.
  // `chosenLanguage` is set only if the person changed the switch on the sign-in page.
  redeem: (token: string | null, chosenLanguage: Lang | null) => Promise<void>
  signOut: () => Promise<void>
  // Demo only: signs in as the sample consultant.
  demoSignIn?: () => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
