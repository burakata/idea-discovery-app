// The demo's own room screens: Discussion, the join page, Burak's queue and private
// notes. The api build leaves this file out (see App.tsx); Discussion joins it in M1 PR 8b.
import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, useOutletContext, useParams } from 'react-router-dom'
import { RoomLayout } from './RoomLayout'
import { findProject } from './projects'
import Discussion from './screens/Discussion'
import Join from './screens/Join'
import Notes from './screens/Notes'
import Queue from './screens/Queue'
import type { Room } from './state/context'
import { useDemoStore } from './state/demoStore'
import { roomPath } from './state/roomRules'

// The shared room frame, with Burak's waiting count from the demo store.
export function DemoRoomLayout() {
  const { projectId = '' } = useParams()
  const { state } = useDemoStore()
  return <RoomLayout queueCount={state.rooms[projectId]?.queue.length ?? 0} />
}

// These screens read the sample project's own config and its demo room. A project Burak
// creates in the demo has neither, so it goes back to the idea page.
function SampleRoomOnly() {
  const room = useOutletContext<Room>()
  const project = findProject(room.id)
  return project ? <Outlet context={project} /> : <Navigate to={roomPath(room.id)} replace />
}

function ConsultantOnly({ children }: { children: ReactNode }) {
  const { viewer } = useDemoStore()
  const { projectId } = useParams()
  if (viewer.role !== 'consultant') return <Navigate to={projectId ? roomPath(projectId) : '/'} replace />
  return children
}

export const demoRoutes = (
  <Route element={<SampleRoomOnly />}>
    <Route path="join" element={<Join />} />
    <Route path="discussion" element={<Discussion />} />
    <Route
      path="queue"
      element={
        <ConsultantOnly>
          <Queue />
        </ConsultantOnly>
      }
    />
    <Route
      path="notes"
      element={
        <ConsultantOnly>
          <Notes />
        </ConsultantOnly>
      }
    />
  </Route>
)
