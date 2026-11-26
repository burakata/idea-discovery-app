// The room's frame, the same in both builds: it loads the room through the store and
// hands it to the screens (the idea page, the shared summary, and the demo's own).
import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { ApiError } from './api/client'
import { AppShell, Page } from './components/AppShell'
import { NoticeBox } from './components/Card'
import { PublicPage } from './components/PublicPage'
import type { Room } from './state/context'
import { useStore } from './state/store'
import { useT } from './strings'

export function RoomLayout({ queueCount }: { queueCount?: number }) {
  const { projectId = '' } = useParams()
  const { pathname } = useLocation()
  const { loadRoom, me } = useStore()
  const { t } = useT()
  const [room, setRoom] = useState<Room | null>(null)
  const [problem, setProblem] = useState<unknown>(null)

  // Loaded again when the person moves inside the room, or the viewer changes (the demo's
  // View as), so a change made on another screen (a new title, a job-flow step the demo's
  // Burak approved) shows at once. The old room stays on screen meanwhile.
  useEffect(() => {
    let current = true
    loadRoom(projectId).then(
      (loaded) => {
        if (!current) return
        setRoom(loaded)
        setProblem(null)
      },
      (failure: unknown) => {
        if (current) setProblem(failure)
      },
    )
    return () => {
      current = false
    }
    // The demo's loadRoom changes identity on every change of its state; only the place and
    // the viewer matter.
  }, [projectId, pathname, me?.id])

  // The project is gone, or this person is not in it. The api client has set the notice.
  // A 401 signs the person out, and the signed-in route above sends them home.
  if (problem instanceof ApiError && problem.status === 404) return <Navigate to="/" replace />

  if (problem) {
    return (
      <AppShell>
        <Page>
          <NoticeBox tone="amber">{t.errors[problem instanceof ApiError ? problem.key : 'generic']}</NoticeBox>
        </Page>
      </AppShell>
    )
  }

  if (!room || room.id !== projectId) {
    return (
      <PublicPage>
        <p role="status">{t.app.loading}</p>
      </PublicPage>
    )
  }

  return (
    <AppShell room={room} queueCount={queueCount}>
      <Outlet context={room} />
    </AppShell>
  )
}
