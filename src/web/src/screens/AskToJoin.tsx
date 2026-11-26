import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { joinErrorKey } from '../api/join'
import { Button } from '../components/Button'
import { Card, NoticeBox } from '../components/Card'
import { TextInput } from '../components/Field'
import { PublicPage } from '../components/PublicPage'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { useDemoT } from '../strings/demo'
import { entryView, POLL_MS, shouldPoll, type JoinView } from './joinRules'
import styles from './Public.module.css'

// Demo only: both sides of asking to join are simulated in this browser.
function SampleNote() {
  const { sample } = useDemoT()
  return <NoticeBox tone="amber">{sample.joinNote}</NoticeBox>
}

// The page behind a project link, for someone with no account. It shows nothing of
// the project, before or after asking: only the app, what this page is, and the
// person's own request. The request's secret is a cookie the browser keeps; nothing
// about it is stored here.
export default function AskToJoin() {
  const { code = '' } = useParams()
  const { joinCanAsk, joinStatus, joinAsk, joinContinue } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  const a = t.askToJoin

  const [view, setView] = useState<JoinView | 'loading'>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(() => document.visibilityState !== 'hidden')

  // The store's functions change identity as the demo state changes; this runs once per link.
  useEffect(() => {
    let current = true
    setView('loading')
    setLoadError(null)
    Promise.all([joinCanAsk(code), joinStatus(code)]).then(
      ([canAsk, status]) => current && setView(entryView(status, canAsk)),
      (failure: unknown) => {
        if (current) setLoadError(t.errors[joinErrorKey(failure)])
      },
    )
    return () => {
      current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  // Waiting: ask again every few seconds, only while the page is on screen.
  useEffect(() => {
    if (!shouldPoll(view, visible)) return
    const timer = window.setInterval(() => {
      joinStatus(code).then(
        (status) => setView(status),
        () => {}, // A missed answer is tried again at the next tick.
      )
    }, POLL_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, visible])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (name.trim() === '') {
      setError(a.nameMissing)
      return
    }
    setBusy(true)
    setError(null)
    try {
      setView(await joinAsk(code, { name: name.trim(), email: email.trim() }))
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === 'cannot_ask') setView('closed')
      else setError(t.errors[joinErrorKey(failure)])
    }
    setBusy(false)
  }

  const proceed = async () => {
    setBusy(true)
    setError(null)
    try {
      await joinContinue()
      navigate('/', { replace: true })
    } catch (failure) {
      // A refused claim is final for this request; a lost connection is worth another try.
      const key = failure instanceof ApiError && (failure.status === 0 || failure.status === 429) ? failure.key : 'cannotClaim'
      setError(t.errors[key])
      setBusy(false)
    }
  }

  return (
    <PublicPage>
      {__DEMO__ && <SampleNote />}
      {loadError ? (
        <Card className={styles.card}>
          <p role="alert" className={styles.error}>
            {loadError}
          </p>
          <div>
            <Button onClick={() => navigate(0)}>{a.tryAgain}</Button>
          </div>
        </Card>
      ) : view === 'loading' ? (
        <p role="status">{a.checking}</p>
      ) : view === 'closed' ? (
        <Card className={styles.card}>
          <h1>{a.closedTitle}</h1>
          <p className={styles.lead}>{t.errors.joinClosed}</p>
        </Card>
      ) : view === 'form' ? (
        <Card className={styles.card}>
          <h1>{a.title}</h1>
          <p className={styles.lead}>{a.intro}</p>
          <form className={styles.form} onSubmit={submit} noValidate>
            <label htmlFor="join-name">{a.nameLabel}</label>
            <TextInput
              id="join-name"
              name="name"
              autoComplete="name"
              maxLength={80}
              aria-describedby="join-name-hint"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <p id="join-name-hint" className={styles.small}>
              {a.nameHint}
            </p>
            <label htmlFor="join-email">{a.emailLabel}</label>
            <TextInput
              id="join-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="off"
              maxLength={254}
              aria-describedby="join-email-hint"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p id="join-email-hint" className={styles.small}>
              {a.emailHint}
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <div>
              <Button variant="primary" type="submit" disabled={busy}>
                {busy ? a.sending : a.submit}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <Card className={styles.card}>
          <div role="status" className={styles.card}>
            <h1>{a[`${view}Title`]}</h1>
            <p className={styles.lead}>{a[view]}</p>
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          {view === 'approved' && (
            <div>
              <Button variant="primary" iconRight="arrowRight" disabled={busy} onClick={() => void proceed()}>
                {busy ? a.continuing : a.continue}
              </Button>
            </div>
          )}
          {view === 'expired' && (
            <div>
              <Button onClick={() => setView('form')}>{a.askAgain}</Button>
            </div>
          )}
        </Card>
      )}
    </PublicPage>
  )
}
