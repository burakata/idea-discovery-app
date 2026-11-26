// The API data source for React: it connects the session in apiSession.ts to the
// Store every screen reads.
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { createApiSession, type ApiSession } from './apiSession'
import { StoreContext, type Store } from './context'

// One session for the page's life, made when the provider first draws.
let shared: ApiSession | undefined
function getSession(): ApiSession {
  shared ??= createApiSession({
    storage: window.localStorage,
    browserLanguages: window.navigator.languages,
  })
  return shared
}

export function ApiProvider({ children }: { children: ReactNode }) {
  const session = getSession()
  const state = useSyncExternalStore(session.subscribe, session.getState)

  useEffect(() => {
    void session.start()
  }, [session])

  const store: Store = {
    status: state.status,
    me: state.me,
    language: state.me ? state.me.uiLanguage : state.guestLanguage,
    setLanguage: session.setLanguage,
    projects: state.projects,
    projectsError: state.projectsError,
    notice: state.notice,
    actionError: state.actionError,
    requestLink: session.requestLink,
    redeem: session.redeem,
    signOut: session.signOut,
    createProject: session.createProject,
    saveProject: session.saveProject,
    getProject: session.getProject,
    loadRoom: session.loadRoom,
    listConversations: session.listConversations,
    readMessages: session.readMessages,
    postMessage: session.postMessage,
    finishConversation: session.finishConversation,
    startConversation: session.startConversation,
    invite: session.invite,
    listInvitations: session.listInvitations,
    revokeInvitation: session.revokeInvitation,
    copyInvitationLink: session.copyInvitationLink,
    copySignInLink: session.copySignInLink,
    listSessions: session.listSessions,
    endSession: session.endSession,
    removeMember: session.removeMember,
    joinCanAsk: session.joinCanAsk,
    joinAsk: session.joinAsk,
    joinStatus: session.joinStatus,
    joinContinue: session.joinContinue,
    joinAsking: session.joinAsking,
    turnOnJoinLink: session.turnOnJoinLink,
    turnOffJoinLink: session.turnOffJoinLink,
    renewJoinLink: session.renewJoinLink,
    listJoinRequests: session.listJoinRequests,
    approveJoinRequest: session.approveJoinRequest,
    rejectJoinRequest: session.rejectJoinRequest,
  }

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
