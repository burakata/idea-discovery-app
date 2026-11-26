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
import { deviceLabel, isLive } from './peopleRules'
import styles from './People.module.css'

const p = c.people

// Shown only when the browser would not copy a link. The link is held by the screen,
// in state set only for this dialog, and is cleared when it closes; it is never in the
// store or in storage. The texts come from the caller: a person's sign-in link and the
// project's join link say different things.
export function LinkDialog({
  title,
  body,
  fieldLabel,
  demoNote,
  link,
  onClose,
}: {
  title: string
  body: string
  fieldLabel: string
  // Demo only: says the link is a sample.
  demoNote?: string
  link: string
  onClose: () => void
}) {
  return (
    <Dialog title={title} onClose={onClose} closeLabel={p.close}>
      <div className={styles.dialogBody}>
        <p>{body}</p>
        {demoNote && <p>{demoNote}</p>}
        <TextInput
          readOnly
          value={link}
          aria-label={fieldLabel}
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

// A confirmation with one decision: replace the join link, reject a request, remove a
// person. Cancel is the focused, safe choice.
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  busy: boolean
  error: ConsultantErrorKey | null
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Dialog title={title} onClose={onClose} closeLabel={p.close}>
      <div className={styles.dialogBody}>
        <p>{body}</p>
        {error && (
          <div role="alert">
            <NoticeBox tone="amber">{c.errors[error]}</NoticeBox>
          </div>
        )}
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            {p.cancel}
          </Button>
          <Button
            variant={danger ? 'secondary' : 'primary'}
            className={danger ? styles.danger : undefined}
            onClick={onConfirm}
            disabled={busy}
          >
            {confirmLabel}
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
    <ConfirmDialog
      title={fill(p.removeTitle, name)}
      body={fill(p.removeBody, name)}
      confirmLabel={fill(p.removeConfirm, name)}
      danger
      busy={busy}
      error={error}
      onConfirm={onConfirm}
      onClose={onClose}
    />
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
