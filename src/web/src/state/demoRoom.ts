// The demo's side of the room: a pure function on the demo state, like demoPeople.ts, so
// its rules can be tested without React. Only the demo build includes this file.
import { ApiError } from '../api/client'
import { emptyContent } from '../api/room'
import { findProject } from '../projects'
import type { ConversationSummary, Room } from './context'
import * as peopleRules from './demoPeople'
import type { AppState } from './types'

// The demo has no conversations yet (PR 8b adds them): every room has one active
// Conversation 1, started on a fixed day so the function stays pure.
const SAMPLE_CONVERSATIONS: ConversationSummary[] = [
  { number: 1, state: 'active', startedAt: '2026-11-12T09:00:00.000Z', finishedAt: null },
]

// Throws a 404 when the project does not exist, or when the viewer is an owner who is not
// in it: the same answer for both, so a room's existence is not revealed.
export function roomOf(state: AppState, projectId: string): Room {
  const details = peopleRules.detailsOf(state, projectId)
  const viewer = state.people[state.viewAs]
  if (viewer.role === 'owner' && !details.members.some((member) => member.userId === viewer.id)) {
    throw new ApiError(404, null)
  }

  // A project Burak created has no sample content and no room in the demo state.
  const sample = findProject(projectId)
  const own = state.rooms[projectId]
  const content = emptyContent()
  if (sample && own) {
    content.jobFlow = own.jobFlow
    content.understanding = sample.understanding
    content.openQuestions = sample.unclear
    content.similarBusinesses = sample.similarBusinesses
    content.statements = own.statements
  }

  return {
    id: projectId,
    title: details.title,
    intro: details.intro,
    members: details.members.map(({ userId, displayName, role }) => ({ userId, displayName, role })),
    conversations: SAMPLE_CONVERSATIONS.map((conversation) => ({ ...conversation })),
    content,
  }
}
