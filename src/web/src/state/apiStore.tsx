// The API data source: sign-in, the person's language and their project list,
// all through the API client. The room screens come in M1 PR 8.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ApiError, createApiClient } from '../api/client'
import { DEFAULT_LANG, isLang, type Lang } from '../languages'
import { languageToSave } from './sessionRules'
import { StoreContext, type Me, type NoticeKey, type ProjectCard, type SessionStatus, type Store } from './context'

const LANGUAGE_KEY = 'idea-discovery-rooms-language'

interface MeResponse {
  id: string
  displayName: string
  uiLanguage: string
  isConsultant: boolean
}

interface ProjectResponse {
  id: string
  titleEn: string
  titleTr: string
}

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
  return { id: project.id, title: { en: project.titleEn, tr: project.titleTr } }
}

function readSavedLanguage(): Lang {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    return isLang(saved) ? saved : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [me, setMe] = useState<Me | null>(null)
  const [guestLanguage, setGuestLanguage] = useState<Lang>(readSavedLanguage)
  const [projects, setProjects] = useState<ProjectCard[] | null>(null)
  const [notice, setNotice] = useState<NoticeKey | null>(null)

  const signedOut = useCallback((next: NoticeKey | null) => {
    setMe(null)
    setProjects(null)
    setNotice(next)
    setStatus('signedOut')
  }, [])

  const clientRef = useRef<ReturnType<typeof createApiClient>>(null)
  clientRef.current ??= createApiClient({
    // A 401 anywhere returns the person to the home; a 404 sends them to their list.
    onStatus: (effect) => {
      if (effect === 'signedOut') signedOut('signedOut')
      else setNotice('projectGone')
    },
  })
  const api = clientRef.current

  const loadProjects = useCallback(
    async () => {
      try {
        setProjects((await api.get<ProjectResponse[]>('/projects')).map(toCard))
      } catch {
        // A 401 has already returned the person to the home. Anything else leaves
        // the list empty, which the screen words neutrally.
        setProjects([])
      }
    },
    [api],
  )

  // Who is signed in, if anyone: the cookie decides.
  useEffect(() => {
    let cancelled = false
    api
      .get<MeResponse>('/auth/me', { expectSignedOut: true })
      .then((body) => {
        if (cancelled) return
        setMe(toMe(body))
        setStatus('signedIn')
        void loadProjects()
      })
      .catch(() => {
        if (!cancelled) signedOut(null)
      })
    return () => {
      cancelled = true
    }
  }, [api, loadProjects, signedOut])

  const rememberGuestLanguage = useCallback((lang: Lang) => {
    setGuestLanguage(lang)
    try {
      localStorage.setItem(LANGUAGE_KEY, lang)
    } catch {
      // Not remembering the visitor's language is harmless.
    }
  }, [])

  const store = useMemo<Store>(
    () => ({
      status,
      me,
      language: me ? me.uiLanguage : guestLanguage,
      setLanguage: (lang) => {
        rememberGuestLanguage(lang)
        if (!me) return
        // Saved to the account; the screen changes at once.
        setMe({ ...me, uiLanguage: lang })
        api.put('/me/language', { language: lang }).catch(() => {})
      },
      projects,
      notice,
      clearNotice: () => setNotice(null),
      requestLink: async (email) => {
        setNotice(null)
        // The answer is the same whatever happened, so nothing is passed on.
        await api.post('/auth/request-link', { email }).catch(() => {})
      },
      redeem: async (token, chosenLanguage) => {
        setNotice(null)
        if (!token) throw new ApiError(400, 'link_not_valid')
        const signedIn = toMe(await api.post<MeResponse>('/auth/redeem', { token }))
        api.forgetCsrfToken()
        // Only a language chosen on the sign-in page changes the account.
        const toSave = languageToSave(chosenLanguage, signedIn.uiLanguage)
        if (toSave) {
          signedIn.uiLanguage = toSave
          await api.put('/me/language', { language: toSave }).catch(() => {})
        }
        rememberGuestLanguage(signedIn.uiLanguage)
        setMe(signedIn)
        setStatus('signedIn')
        void loadProjects()
      },
      signOut: async () => {
        // Signed out here whatever the API answers; the session is ended on the server when it can be.
        await api.post('/auth/sign-out').catch(() => {})
        api.forgetCsrfToken()
        signedOut(null)
      },
    }),
    [status, me, guestLanguage, projects, notice, api, loadProjects, rememberGuestLanguage, signedOut],
  )

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
