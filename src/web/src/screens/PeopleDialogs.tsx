import { useEffect, useState } from 'react'
import { ApiError, type ConsultantErrorKey } from '../api/client'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { TextInput } from '../components/Field'
import { Pill } from '../components/Pill'
import type { Member, SignInSession } from '../state/context'
import { useStore } from '../state/store'
import { fill, useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { demoPeople } from '../strings/demo'
import { deviceLabel, isLive } from './peopleRules'
import styles from './People.module.css'

const p = c.people

// Shown only when the browser would not copy the link. The link is held by the
// People screen, in state set only for this dialog, and is cleared when it closes;
// it is never in the store or in storage.
export function LinkDialog({ name, link, onClose }: { name: string; link: string; onClose: () => void }) {
  return (
    <Dialog title={p.linkFallbackTitle} onClose={onClose} closeLabel={p.close}>
      <div className={styles.dialogBody}>
        <p>{fill(p.linkFallbackBody, { name })}</p>
        {__DEMO__ && <p>{demoPeople.sampleLink}</p>}
        <TextInput
          readOnly
          value={link}
          aria-label={fill(p.linkField, { name })}
          data-autofocus
          onFocus={(event) => event.currentTarget.select()}
        />
        <div className={styles.dialogActions}>
          <Button variant="primary" onClick={onClose}>
            {p.close}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function RemoveDialog({
  member,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  member: Member
  busy: boolean
  error: ConsultantErrorKey | null
  onConfirm: () => void
  onClose: () => void
}) {
  const name = { name: member.displayName }
  return (
    <Dialog title={fill(p.removeTitle, name)} onClose={onClose} closeLabel={p.close}>
      <div className={styles.dialogBody}>
        <p>{fill(p.removeBody, name)}</p>
        {error && (
          <div role="alert">
            <NoticeBox tone="amber">{c.errors[error]}</NoticeBox>
          </div>
        )}
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            {p.cancel}
          </Button>
          <Button variant="secondary" className={styles.danger} onClick={onConfirm} disabled={busy}>
            {fill(p.removeConfirm, name)}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

export function SessionsDialog({ member, onClose }: { member: Member; onClose: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  const { listSessions, endSession } = useStore()
  const { time } = useT()
  const [sessions, setSessions] = useState<SignInSession[] | null>(null)
  const [error, setError] = useState<ConsultantErrorKey | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () =>
    listSessions(member.userId).then(setSessions, (failure: unknown) =>
      setError(failure instanceof ApiError ? failure.consultantKey : 'generic'),
    )

  useEffect(() => {
    void load()
    // Loaded when the dialog opens, for this person.
  }, [member.userId])

  const end = async (id: string) => {
    setBusy(id)
    setError(null)
    setConfirmed(false)
    try {
      await endSession(id)
      setConfirmed(true)
      await load()
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.consultantKey : 'generic')
    }
    setBusy(null)
  }

  const now = new Date()
  return (
    <Dialog title={fill(p.sessionsTitle, { name: member.displayName })} onClose={onClose} closeLabel={p.close}>
      <div className={styles.dialogBody}>
        <p className={styles.hint}>{p.sessionsSub}</p>
        {error && (
          <div role="alert">
            <NoticeBox tone="amber">{c.errors[error]}</NoticeBox>
          </div>
        )}
        <div role="status">{confirmed && !error && <NoticeBox>{p.sessionEnded}</NoticeBox>}</div>
        {!sessions && !error && <p role="status">{p.loading}</p>}
        {sessions?.length === 0 && <p>{p.noSessions}</p>}
        <ul className={styles.sessions}>
          {sessions?.map((session) => {
            const live = isLive(session, now)
            return (
              <li key={session.id} className={styles.session}>
                <div className={styles.sessionText}>
                  <strong title={session.device ?? undefined}>{deviceLabel(session.device)}</strong>
                  <span>{fill(p.started, { time: time(session.createdAt) })}</span>
                  {session.lastSeenAt && <span>{fill(p.lastSeen, { time: time(session.lastSeenAt) })}</span>}
                  {session.endedAt && <span>{fill(p.ended, { time: time(session.endedAt) })}</span>}
                </div>
                {live ? (
                  <div className={styles.sessionAction}>
                    <Pill tone="green">{p.live}</Pill>
                    <Button
                      size="sm"
                      disabled={busy === session.id}
                      aria-label={fill(p.endLabel, { device: deviceLabel(session.device) })}
                      onClick={() => void end(session.id)}
                    >
                      {p.end}
                    </Button>
                  </div>
                ) : (
                  <Pill tone="neutral">{session.endedAt ? p.over : p.expired}</Pill>
                )}
              </li>
            )
          })}
        </ul>
        <div className={styles.dialogActions}>
          <Button variant="primary" onClick={onClose} data-autofocus>
            {p.close}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
