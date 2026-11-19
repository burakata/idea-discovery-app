import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PrototypeBar } from './components/PrototypeBar'
import { findProject, projects } from './projects'
import Discussion from './screens/Discussion'
import Idea from './screens/Idea'
import Join from './screens/Join'
import Notes from './screens/Notes'
import Queue from './screens/Queue'
import Rooms from './screens/Rooms'
import Summary from './screens/Summary'
import { StoreProvider, useStore } from './state/store'

function Home() {
  const { viewer } = useStore()
  return <Navigate to={`/rooms/${viewer.roomId ?? projects[0].id}`} replace />
}

// Owners see only their own room.
function RoomLayout() {
  const { roomId } = useParams()
  const { viewer } = useStore()
  const project = findProject(roomId)
  if (!project) return <Navigate to="/" replace />
  if (viewer.role === 'owner' && viewer.roomId !== project.id) return <Navigate to="/" replace />
  return (
    <AppShell project={project}>
      <Outlet context={project} />
    </AppShell>
  )
}

function ConsultantOnly({ children }: { children: ReactNode }) {
  const { viewer } = useStore()
  const { roomId } = useParams()
  if (viewer.role !== 'consultant') return <Navigate to={roomId ? `/rooms/${roomId}` : '/'} replace />
  return children
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <PrototypeBar />
        <Routes>
          <Route
            path="/rooms"
            element={
              <ConsultantOnly>
                <AppShell>
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
          <Route path="*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}
