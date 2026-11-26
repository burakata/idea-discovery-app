import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PublicPage } from './components/PublicPage'
import { PrototypeBar } from './components/PrototypeBar'
import { DemoRoomLayout, demoRoutes } from './DemoRoutes'
import { RoomLayout } from './RoomLayout'
import AskToJoin from './screens/AskToJoin'
import Home from './screens/Home'
import Idea from './screens/Idea'
import People from './screens/People'
import ProjectForm from './screens/ProjectForm'
import Projects from './screens/Projects'
import SignIn from './screens/SignIn'
import Summary from './screens/Summary'
import { StoreProvider, useStore } from './state/store'
import { useT } from './strings'

// Rooms are for signed-in people only; after a 401 the person goes home.
function SignedInOnly() {
  const { status } = useStore()
  return status === 'signedIn' ? <Outlet /> : <Navigate to="/" replace />
}

// Burak's screens: anyone else goes back to the list.
function ConsultantScreen({ children }: { children: ReactNode }) {
  const { me } = useStore()
  return me?.isConsultant ? <AppShell>{children}</AppShell> : <Navigate to="/" replace />
}

function AppRoutes() {
  const { status } = useStore()
  const { lang, t } = useT()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Until the app knows whether anyone is signed in, it shows the page frame and
  // a short line: not the home, and certainly not a project.
  if (status === 'checking') {
    return (
      <PublicPage>
        <p role="status">{t.app.loading}</p>
      </PublicPage>
    )
  }

  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      {/* Outside the signed-in shell: the person asking has no account yet. */}
      <Route path="/join/:code" element={<AskToJoin />} />
      <Route
        path="/"
        element={
          status === 'signedIn' ? (
            <AppShell>
              <Projects />
            </AppShell>
          ) : (
            <Home />
          )
        }
      />
      <Route path="/projects/new" element={<ConsultantScreen><ProjectForm /></ConsultantScreen>} />
      <Route path="/projects/:projectId/edit" element={<ConsultantScreen><ProjectForm /></ConsultantScreen>} />
      <Route path="/projects/:projectId/people" element={<ConsultantScreen><People /></ConsultantScreen>} />
      {/* A project's room, for both builds. Rooms are for signed-in people only. */}
      <Route element={<SignedInOnly />}>
        <Route path="/projects/:projectId" element={__DEMO__ ? <DemoRoomLayout /> : <RoomLayout />}>
          <Route index element={<Idea />} />
          <Route path="summary" element={<Summary />} />
          {/* The demo's Discussion, queue and notes. Discussion joins the api build in PR 8b. */}
          {__DEMO__ && demoRoutes}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        {__DEMO__ && <PrototypeBar />}
        <AppRoutes />
      </BrowserRouter>
    </StoreProvider>
  )
}
