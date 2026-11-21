import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PrototypeBar } from './components/PrototypeBar'
import { demoRoutes } from './DemoRoutes'
import Home from './screens/Home'
import Projects from './screens/Projects'
import SignIn from './screens/SignIn'
import { StoreProvider, useStore } from './state/store'
import { useT } from './strings'

function AppRoutes() {
  const { status } = useStore()
  const { lang } = useT()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Until the app knows whether anyone is signed in, it shows nothing: not the
  // home, and certainly not a project.
  if (status === 'checking') return null

  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
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
      {__DEMO__ && demoRoutes}
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
