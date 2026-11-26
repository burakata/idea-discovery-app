import { createContext, useContext } from 'react'
import type { ErrorKey } from '../api/client'
import type { Lang } from '../languages'
import type { Bilingual, JobFlowStep, SimilarBusiness, Text } from '../projects/types'
import type { Statement } from './types'

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

// One project in the person's list. Every card opens the project's room.
export interface ProjectCard {
  id: string
  title: Text
  lead?: Text
}

// Burak's project form: every language in languages.ts, so no language is named here.
export interface ProjectDraft {
  title: Bilingual
  intro: Bilingual
}

export interface Member {
  userId: string
  displayName: string
  role: 'consultant' | 'owner'
  // Only Burak's screens get emails.
  email: string | null
}

export interface ProjectDetails extends ProjectDraft {
  id: string
  // Changes with every new image; null when the project has none.
  imageVersion: string | null
  members: Member[]
}

// A project's room (M1 PR 8a). Everyone in it sees the same, so members carry no email.
export interface RoomMember {
  userId: string
  displayName: string
  role: 'consultant' | 'owner'
}

export interface ConversationSummary {
  number: number
  state: 'active' | 'finished'
  startedAt: string
  finishedAt: string | null
}

// One message of a conversation, the same in both builds. `assistant` and `tag` come only
// from the demo's scripted assistant. A writer who has left the project has no role.
// `translation` is empty until real translations exist (M2).
export interface RoomMessage {
  id: string
  authorId: string
  authorName: string
  authorRole: 'consultant' | 'owner' | 'assistant' | null
  authorLeft: boolean
  text: string
  language: Lang
  translation: string | null
  createdAt: string
  tag?: 'scripted'
}

// New messages after a cursor, which is opaque: pass it back to read what follows.
export interface MessagePage {
  messages: RoomMessage[]
  cursor: string
}

// What the idea page and the shared summary show. The API has none of it until M3, so
// its lists are always empty; the demo fills them for the sample project.
// A type, not an interface, so the A16 test can read it as a plain record of lists.
export type IdeaContent = {
  jobFlow: JobFlowStep[]
  understanding: Text[]
  openQuestions: Text[]
  similarBusinesses: SimilarBusiness[]
  statements: Statement[]
}

export interface Room {
  id: string
  title: Bilingual
  intro: Bilingual
  imageVersion: string | null
  members: RoomMember[]
  conversations: ConversationSummary[]
  content: IdeaContent
}

export type InvitationState ='open' | 'accepted' | 'revoked' | 'expired'

export interface Invitation {
  id: string
  email: string
  displayName: string
  language: Lang
  state: InvitationState
  createdAt: string
  expiresAt: string
}

export interface SignInSession {
  id: string
  createdAt: string
  lastSeenAt: string | null
  expiresAt: string
  endedAt: string | null
  device: string | null
}

export interface InviteInput {
  email: string
  displayName: string
  language: Lang
}

// The three things that can come back from an invitation. The other refusals
// (already a member, already invited, your own address) are errors.
export type InviteOutcome =
  | { kind: 'invited' }
  | { kind: 'added'; displayName: string }
  | { kind: 'tryLater' }

// Ask to join (M1 PR 7c). The state of one request, as the person who asked sees it.
// "expired": this browser's request for this link has run out. "none": this browser holds no
// request for this link (none at all, one for another link, or one already used); the answer
// is the same for all three, so it reveals nothing.
export type JoinState = 'pending' | 'approved' | 'rejected' | 'expired' | 'none'

export interface JoinInput {
  name: string
  // Optional, unchecked, and only for Burak to recognise the person. Never used to send anything.
  email: string
}

// One waiting request, as Burak sees it.
export interface JoinRequest {
  id: string
  name: string
  uncheckedEmail: string | null
  device: string | null
  createdAt: string
  expiresAt: string
  nameMatchesMember: boolean
}

// A copied link goes to the clipboard and nowhere else. Only when the clipboard
// is unavailable does the link come back, once, to be shown in the open dialog.
export type CopyResult = { copied: true } | { copied: false; link: string }

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
  // A project's room, for the idea page and the shared summary (M1 PR 8a). Throws an
  // ApiError: a 404 when the project is gone or the person is not in it.
  loadRoom: (projectId: string) => Promise<Room>
  // The discussion (M1 PR 8b). Refusals throw an ApiError; the screens show text for its `key`.
  // Without a cursor, readMessages gives the whole conversation. Only Burak may finish or start.
  listConversations: (projectId: string) => Promise<ConversationSummary[]>
  readMessages: (projectId: string, number: number, cursor?: string) => Promise<MessagePage>
  postMessage: (projectId: string, text: string) => Promise<RoomMessage>
  finishConversation: (projectId: string) => Promise<void>
  startConversation: (projectId: string) => Promise<ConversationSummary>

  // Burak's project and people actions (M1 PR 7b). They throw an ApiError when the
  // call is refused; the screens show text for its `consultantKey`. Both
  // implementations reload the project list after a change to it.
  createProject: (draft: ProjectDraft) => Promise<string>
  saveProject: (id: string, draft: ProjectDraft) => Promise<void>
  getProject: (id: string) => Promise<ProjectDetails>
  // The project image (M1 PR 8c). Only Burak sets or removes it; members see it on the idea
  // page. Upload returns the new version; refusals throw an ApiError. `projectImageUrl` is
  // the address to show, the demo's data URL in the demo.
  uploadProjectImage: (projectId: string, file: File) => Promise<string>
  removeProjectImage: (projectId: string) => Promise<void>
  projectImageUrl: (projectId: string, version: string) => string
  invite: (projectId: string, input: InviteInput) => Promise<InviteOutcome>
  listInvitations: (projectId: string) => Promise<Invitation[]>
  revokeInvitation: (invitationId: string) => Promise<void>
  copyInvitationLink: (invitationId: string) => Promise<CopyResult>
  copySignInLink: (userId: string) => Promise<CopyResult>
  listSessions: (userId: string) => Promise<SignInSession[]>
  endSession: (sessionId: string) => Promise<void>
  removeMember: (projectId: string, userId: string) => Promise<void>

  // Ask to join, the person's side (M1 PR 7c). All work signed out and throw an
  // ApiError when refused; the screens show text for its `key`. Nothing of the
  // project is ever returned: only whether asking is open, and this browser's own request.
  joinCanAsk: (code: string) => Promise<boolean>
  joinAsk: (code: string, input: JoinInput) => Promise<JoinState>
  // With the link's code, a request made on another project's link reads as "expired":
  // this page shows only what belongs to this link.
  joinStatus: (code?: string) => Promise<JoinState>
  // Completes sign-in once the request is approved, then the project list loads.
  joinContinue: () => Promise<void>
  // Ask to join, Burak's side. The link actions copy it and return it only if the clipboard refuses.
  joinAsking: (projectId: string) => Promise<boolean>
  turnOnJoinLink: (projectId: string) => Promise<CopyResult>
  turnOffJoinLink: (projectId: string) => Promise<void>
  renewJoinLink: (projectId: string) => Promise<CopyResult>
  listJoinRequests: (projectId: string) => Promise<JoinRequest[]>
  // Returns the name the person was given.
  approveJoinRequest: (requestId: string, displayName?: string) => Promise<string>
  rejectJoinRequest: (requestId: string) => Promise<void>

  // Demo only: signs in as the sample consultant.
  demoSignIn?: () => void
}

export const StoreContext = createContext<Store | null>(null)

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore must be used inside StoreProvider')
  return store
}
