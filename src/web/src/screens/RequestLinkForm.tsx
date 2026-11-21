import { useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/Card'
import { TextInput } from '../components/Field'
import { useStore } from '../state/store'
import { fill, useT } from '../strings'
import { DemoNoEmail } from './DemoNoEmail'
import styles from './Public.module.css'

// Asking for a sign-in link. The confirmation is the same whatever happened,
// so it never tells anyone whether an email belongs to a member.
export function RequestLinkForm() {
  const { requestLink } = useStore()
  const { t } = useT()
  const [email, setEmail] = useState('')
  // The address the confirmation names, as it was sent.
  const [sentTo, setSentTo] = useState('')
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form')
  const [missing, setMissing] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    setMissing(trimmed === '')
    if (trimmed === '') return
    setPhase('sending')
    await requestLink(trimmed)
    setSentTo(trimmed)
    setPhase('sent')
  }

  if (phase === 'sent') {
    return (
      <div className={styles.form}>
        {/* The demo sends nothing, so it must not say that a link is on its way. */}
        {__DEMO__ ? (
          <DemoNoEmail />
        ) : (
          <>
            <NoticeBox title={t.auth.home.sentTitle}>{fill(t.auth.home.sent, { email: sentTo })}</NoticeBox>
            <p className={styles.small}>{t.auth.home.sentHint}</p>
          </>
        )}
        <div>
          <Button variant="quiet" onClick={() => setPhase('form')}>
            {t.auth.home.askAgain}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {__DEMO__ && <DemoNoEmail />}
      <label htmlFor="sign-in-email">{t.auth.home.emailLabel}</label>
      <TextInput
        id="sign-in-email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={missing}
        aria-describedby={missing ? 'sign-in-email-error' : undefined}
      />
      {missing && (
        <p id="sign-in-email-error" className={styles.error}>
          {t.auth.home.emailMissing}
        </p>
      )}
      <Button variant="primary" icon="send" type="submit" disabled={phase === 'sending'}>
        {t.auth.home.submit}
      </Button>
    </form>
  )
}
