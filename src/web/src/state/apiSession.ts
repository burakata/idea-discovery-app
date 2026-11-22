// The signed-in session against the API, as plain code so its rules can be tested:
// who is signed in, the person's projects and language, and what happens after a
// 401, a failed sign-out or a failed list. apiStore.tsx only connects it to React.
import { ApiError, createApiClient, type ErrorKey } from '../api/client'
import { bilingualFrom, createConsultantApi } from '../api/consultant'
import { browserLang, DEFAULT_LANG, isLang, type Lang } from '../languages'
import { browserClipboard, copyLink, type Clipboard } from './copyLink'
import { languageToSave } from './sessionRules'
import type { InviteInput, Me, NoticeKey, ProjectCard, ProjectDraft, SessionStatus } from './context'

const LANGUAGE_KEY = 'idea-discovery-rooms-language'

export interface SessionState {
  status: SessionStatus
  me: Me | null
  guestLanguage: Lang
  projects: ProjectCard[] | null
  projectsError: ErrorKey | null
  notice: NoticeKey | null
  actionError: ErrorKey | null
}

interface MeResponse {
  id: string
  displayName: string
  uiLanguage: string
  isConsultant: boolean
}

type ProjectResponse = Record<string, unknown> & { id: string }

// Data from the API is checked where it comes in (docs/engineering.md section 7).
function toMe(body: MeResponse): Me {
  return {
    id: body.id,
    displayName: body.displayName,
    uiLanguage: isLang(body.uiLanguage) ? body.uiLanguage : DEFAULT_LANG,
    isConsultant: body.isConsultant === true,
  }
}

function toCard(project: ProjectResponse): ProjectCard {
  return { id: project.id, title: bilingualFrom(project, 'title') }
}

export interface SessionOptions {
  fetch?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
  // navigator.languages: used when the visitor has not chosen a language yet.
  browserLanguages?: readonly string[]
  // Where copied links go; the browser's own when not given.
  clipboard?: Clipboard
}

export function createApiSession(options: SessionOptions = {}) {
  const storage = options.storage
  const saved = (() => {
    try {
      const value = storage?.getItem(LANGUAGE_KEY)
      return isLang(value) ? value : null
    } catch {
      return null
    }
  })()

  let state: SessionState = {
    status: 'checking',
    me: null,
    guestLanguage: saved ?? browserLang(options.browserLanguages ?? []),
    projects: null,
    projectsError: null,
    notice: null,
    actionError: null,
  }
  const listeners = new Set<() => void>()
  const set = (change: Partial<SessionState>) => {
    state = { ...state, ...change }
    listeners.forEach((listener) => listener())
  }

  const signedOutState = (notice: NoticeKey | null): Partial<SessionState> => ({
    status: 'signedOut',
    me: null,
    projects: null,
    projectsError: null,
    actionError: null,
    notice,
  })

  const api = createApiClient({
    fetch: options.fetch,
    // A 401 anywhere returns the person to the home; a 404 sends them to their list.
    onStatus: (effect) => {
      if (effect === 'signedOut') {
        api.forgetCsrfToken()
        set(signedOutState('signedOut'))
      } else set({ notice: 'projectGone' })
    },
  })

  const rememberLanguage = (lang: Lang) => {
    set({ guestLanguage: lang })
    try {
      storage?.setItem(LANGUAGE_KEY, lang)
    } catch {
      // Not remembering the visitor's language is harmless.
    }
  }

  const consultantApi = createConsultantApi(api)
  const clipboard = () => options.clipboard ?? browserClipboard()

  async function loadProjects() {
    set({ notice: null, projects: null, projectsError: null })
    try {
      set({ projects: (await api.get<ProjectResponse[]>('/projects')).map(toCard) })
    } catch (failure) {
      // After a 401 the person is already on the home; any other failure is said out loud.
      if (state.status === 'signedIn') {
        set({ projectsError: failure instanceof ApiError ? failure.key : 'generic' })
      }
    }
  }

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    // Who is signed in, if anyone: the cookie decides.
    async start() {
      try {
        const me = toMe(await api.get<MeResponse>('/auth/me', { expectSignedOut: true }))
        set({ me, status: 'signedIn' })
      } catch {
        set(signedOutState(null))
        return
      }
      await loadProjects()
    },

    loadProjects,

    setLanguage(lang: Lang) {
      rememberLanguage(lang)
      const me = state.me
      if (!me) return
      // Saved to the account; the screen changes at once.
      set({ me: { ...me, uiLanguage: lang } })
      api.put('/me/language', { language: lang }).catch(() => {})
    },

    // The answer is the same whatever happened, so nothing is passed on.
    async requestLink(email: string) {
      set({ notice: null })
      await api.post('/auth/request-link', { email }).catch(() => {})
    },

    async redeem(token: string | null, chosenLanguage: Lang | null) {
      set({ notice: null })
      if (!token) throw new ApiError(400, 'link_not_valid')
      const me = toMe(await api.post<MeResponse>('/auth/redeem', { token }))
      api.forgetCsrfToken()
      // Only a language chosen on the sign-in page changes the account.
      const toSave = languageToSave(chosenLanguage, me.uiLanguage)
      if (toSave) {
        me.uiLanguage = toSave
        await api.put('/me/language', { language: toSave }).catch(() => {})
      }
      rememberLanguage(me.uiLanguage)
      set({ me, status: 'signedIn', actionError: null })
      void loadProjects()
    },

    // Burak's actions. Each goes through the api client; a change to the project list
    // reloads it. Refusals are thrown as ApiError for the screen to show.
    async createProject(draft: ProjectDraft) {
      const project = await consultantApi.createProject(draft)
      await loadProjects()
      return project.id
    },
    async saveProject(id: string, draft: ProjectDraft) {
      await consultantApi.saveProject(id, draft)
      await loadProjects()
    },
    getProject: consultantApi.getProject,
    invite: (projectId: string, input: InviteInput) => consultantApi.invite(projectId, input),
    listInvitations: consultantApi.listInvitations,
    revokeInvitation: consultantApi.revokeInvitation,
    copyInvitationLink: (invitationId: string) =>
      copyLink(() => consultantApi.invitationLink(invitationId), clipboard()),
    copySignInLink: (userId: string) => copyLink(() => consultantApi.signInLink(userId), clipboard()),
    listSessions: consultantApi.listSessions,
    endSession: consultantApi.endSession,
    removeMember: consultantApi.removeMember,

    // Local state is cleared only when the server confirms (204) or says nobody is
    // signed in (401). Otherwise the person stays signed in and is told.
    async signOut() {
      set({ actionError: null })
      try {
        await api.post('/auth/sign-out')
      } catch (failure) {
        if (!(failure instanceof ApiError && failure.status === 401)) {
          set({ actionError: failure instanceof ApiError ? failure.key : 'generic' })
          return
        }
      }
      api.forgetCsrfToken()
      set(signedOutState('signedOutByYou'))
    },
  }
}

export type ApiSession = ReturnType<typeof createApiSession>
