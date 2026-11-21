// The demo's room screens. The real room screens come in M1 PR 8; until then the
// api build has no rooms, so this file is left out of it (see App.tsx).
import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, useParams } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { findProject } from './projects'
import Discussion from './screens/Discussion'
import Idea from './screens/Idea'
import Join from './screens/Join'
import Notes from './screens/Notes'
import Queue from './screens/Queue'
import Rooms from './screens/Rooms'
import Summary from './screens/Summary'
import { useDemoStore } from './state/demoStore'
import { useStore } from './state/store'
import { consultant as c } from './strings/consultant'

// Rooms are for signed-in people only.
function SignedInOnly() {
  const { status } = useStore()
  return status === 'signedIn' ? <Outlet /> : <Navigate to="/" replace />
}

// Owners see only their own room.
function RoomLayout() {
  const { roomId } = useParams()
  const { state, viewer } = useDemoStore()
  const project = findProject(roomId)
  if (!project) return <Navigate to="/" replace />
  if (viewer.role === 'owner' && viewer.roomId !== project.id) return <Navigate to="/" replace />
  return (
    <AppShell project={project} queueCount={state.rooms[project.id].queue.length}>
      <Outlet context={project} />
    </AppShell>
  )
}

function ConsultantOnly({ children }: { children: ReactNode }) {
  const { viewer } = useDemoStore()
  const { roomId } = useParams()
  if (viewer.role !== 'consultant') return <Navigate to={roomId ? `/rooms/${roomId}` : '/'} replace />
  return children
}

export const demoRoutes = (
  <Route element={<SignedInOnly />}>
    <Route
      path="/rooms"
      element={
        <ConsultantOnly>
          <AppShell title={c.rooms.title}>
            <Rooms />
          </AppShell>
        </ConsultantOnly>
      }
    />
    <Route path="/rooms/:roomId" element={<RoomLayout />}>
      <Route index element={<Idea />} />
      <Route path="join" element={<Join />} />
      <Route path="discussion" element={<Discussion />} />
      <Route path="summary" element={<Summary />} />
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
  </Route>
)
