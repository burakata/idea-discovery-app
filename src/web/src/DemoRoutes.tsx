// The demo's own room screens: Burak's queue and private notes. The api build leaves this
// file out (see App.tsx).
import type { ReactNode } from 'react'
import { Navigate, Route, useParams } from 'react-router-dom'
import { RoomLayout } from './RoomLayout'
import Notes from './screens/Notes'
import Queue from './screens/Queue'
import { useDemoStore } from './state/demoStore'
import { roomPath } from './state/roomRules'

// The shared room frame, with Burak's waiting count from the demo store.
export function DemoRoomLayout() {
  const { projectId = '' } = useParams()
  const { state } = useDemoStore()
  return <RoomLayout queueCount={state.rooms[projectId]?.queue.length ?? 0} />
}

function ConsultantOnly({ children }: { children: ReactNode }) {
  const { viewer } = useDemoStore()
  const { projectId } = useParams()
  if (viewer.role !== 'consultant') return <Navigate to={projectId ? roomPath(projectId) : '/'} replace />
  return children
}

export const demoRoutes = (
  <>
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
  </>
)
