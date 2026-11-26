import { useEffect, useState } from 'react'
import { ApiError, type ConsultantErrorKey } from '../api/client'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox, SectionTitle } from '../components/Card'
import { Pill } from '../components/Pill'
import type { CopyResult, JoinRequest } from '../state/context'
import { useStore } from '../state/store'
import { fill, useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { demoPeople } from '../strings/demo'
import { ApproveDialog, ConfirmDialog, JoinLinkDialog } from './AskingDialogs'
import { emailLine, joinCopiedMessage, nameWarning } from './joinRules'
import { deviceLabel } from './peopleRules'
import styles from './People.module.css'

const a = c.people.asking

type Note = { tone: 'info' | 'amber'; text: string }
type Deciding = { kind: 'approve' | 'reject'; request: JoinRequest; busy: boolean; error: ConsultantErrorKey | null }

const keyOf = (failure: unknown): ConsultantErrorKey => (failure instanceof ApiError ? failure.consultantKey : 'generic')
const errorNote = (failure: unknown): Note => ({ tone: 'amber', text: c.errors[keyOf(failure)] })

// Burak's "Asking to join" section for one project: switch asking on or off, copy or
// replace the link, and answer the people who asked. English only.
export function AskingToJoin({ projectId, onApproved }: { projectId: string; onApproved: () => Promise<void> }) {
  const store = useStore()
  const { time } = useT()
  // null: not known on this page (the API cannot say); true or false once known.
  const [asking, setAsking] = useState<boolean | null>(null)
  const [requests, setRequests] = useState<JoinRequest[] | null>(null)
  const [note, setNote] = useState<Note | null>(null)
  const [busy, setBusy] = useState(false)
  const [renewing, setRenewing] = useState<{ busy: boolean; error: ConsultantErrorKey | null } | null>(null)
  const [deciding, setDeciding] = useState<Deciding | null>(null)
  // The one place a link is ever held: only if the browser would not copy it, and
  // only while its dialog is open.
  const [fallback, setFallback] = useState<string | null>(null)

  const load = async () => {
    try {
      const [on, list] = await Promise.all([store.joinAsking(projectId), store.listJoinRequests(projectId)])
      // Where the API cannot say, what Burak did on this page is the better answer.
      setAsking((known) => on ?? known)
      setRequests(list)
    } catch (failure) {
      setNote(errorNote(failure))
    }
  }

  useEffect(() => {
    void load()
    // Loaded once per project: the store's functions change identity as the demo state changes.
  }, [projectId])

  const afterCopy = (result: CopyResult) => {
    const text = joinCopiedMessage(result)
    if (text) setNote({ tone: 'info', text: __DEMO__ ? `${text} ${demoPeople.joinLink}` : text })
    else if (!result.copied) setFallback(result.link)
  }

  const turnOn = async () => {
    setBusy(true)
    setNote(null)
    try {
      afterCopy(await store.turnOnJoinLink(projectId))
      setAsking(true)
    } catch (failure) {
      setNote(errorNote(failure))
    }
    setBusy(false)
  }

  const turnOff = async () => {
    setBusy(true)
    setNote(null)
    try {
      await store.turnOffJoinLink(projectId)
      setAsking(false)
      setNote({ tone: 'info', text: a.turnedOff })
    } catch (failure) {
      setNote(errorNote(failure))
    }
    setBusy(false)
  }

  const renew = async () => {
    setRenewing({ busy: true, error: null })
    try {
      const result = await store.renewJoinLink(projectId)
      setRenewing(null)
      setNote(null)
      afterCopy(result)
    } catch (failure) {
      setRenewing({ busy: false, error: keyOf(failure) })
    }
  }

  const decide = async (displayName?: string) => {
    if (!deciding) return
    const { kind, request } = deciding
    setDeciding({ ...deciding, busy: true, error: null })
    try {
      if (kind === 'approve') {
        // The corrected name only when Burak changed it.
        const given = await store.approveJoinRequest(request.id, displayName === request.name ? undefined : displayName)
        setNote({ tone: 'info', text: fill(a.approved, { name: given }) })
      } else {
        await store.rejectJoinRequest(request.id)
        setNote({ tone: 'info', text: fill(a.rejected, { name: request.name }) })
      }
      setDeciding(null)
      setRequests(await store.listJoinRequests(projectId))
      if (kind === 'approve') await onApproved()
    } catch (failure) {
      setDeciding({ ...deciding, busy: false, error: keyOf(failure) })
      // Another decision may have got there first: show where it stands.
      if (failure instanceof ApiError && failure.code === 'request_not_waiting') await load()
    }
  }

  return (
    <>
      <SectionTitle title={a.title} sub={a.sub} />
      <Card>
        <div className={styles.askingHead}>
          {asking !== null && <Pill tone={asking ? 'green' : 'neutral'}>{asking ? a.on : a.off}</Pill>}
          <div className={styles.actions}>
            {asking !== true && (
              <Button size="sm" icon="send" disabled={busy} onClick={() => void turnOn()}>
                {a.turnOn}
              </Button>
            )}
            {asking === true && (
              <>
                <Button size="sm" icon="send" disabled={busy} onClick={() => void turnOn()}>
                  {a.copyLink}
                </Button>
                <Button size="sm" icon="reset" disabled={busy} onClick={() => setRenewing({ busy: false, error: null })}>
                  {a.renew}
                </Button>
              </>
            )}
            {asking !== false && (
              <Button size="sm" icon="close" disabled={busy} onClick={() => void turnOff()}>
                {a.turnOff}
              </Button>
            )}
          </div>
        </div>
        {asking === null && <p className={styles.hint}>{a.unknown}</p>}
        <p className={styles.hint}>{a.linkNote}</p>
        <div role="status">{note && <NoticeBox tone={note.tone}>{note.text}</NoticeBox>}</div>
      </Card>

      <SectionTitle
        title={a.waiting}
        sub={a.waitingSub}
        aside={
          <Button size="sm" variant="quiet" icon="reset" onClick={() => void load()}>
            {a.refresh}
          </Button>
        }
      />
      {requests?.length === 0 && <Empty>{a.none}</Empty>}
      <ul className={styles.invitations}>
        {requests?.map((request) => {
          const warning = nameWarning(request)
          return (
            <li key={request.id}>
              <Card className={styles.invitation}>
                <div className={styles.name}>
                  <strong>{request.name}</strong>
                  <span className={styles.email}>{emailLine(request)}</span>
                  <span title={request.device ?? undefined}>
                    {deviceLabel(request.device)} · {fill(a.asked, { time: time(request.createdAt) })}
                  </span>
                </div>
                {warning && <Pill tone="amber">{warning}</Pill>}
                <div className={styles.actions}>
                  <Button
                    size="sm"
                    icon="check"
                    onClick={() => setDeciding({ kind: 'approve', request, busy: false, error: null })}
                  >
                    {a.approve}
                  </Button>
                  <Button
                    size="sm"
                    icon="close"
                    className={styles.danger}
                    onClick={() => setDeciding({ kind: 'reject', request, busy: false, error: null })}
                  >
                    {a.reject}
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      {renewing && (
        <ConfirmDialog
          title={a.renewTitle}
          body={a.renewBody}
          confirmLabel={a.renewConfirm}
          busy={renewing.busy}
          error={renewing.error}
          onConfirm={() => void renew()}
          onClose={() => setRenewing(null)}
        />
      )}
      {deciding?.kind === 'approve' && (
        <ApproveDialog
          name={deciding.request.name}
          busy={deciding.busy}
          error={deciding.error}
          onConfirm={(displayName) => void decide(displayName)}
          onClose={() => setDeciding(null)}
        />
      )}
      {deciding?.kind === 'reject' && (
        <ConfirmDialog
          title={fill(a.rejectTitle, { name: deciding.request.name })}
          body={a.rejectBody}
          confirmLabel={a.rejectConfirm}
          danger
          busy={deciding.busy}
          error={deciding.error}
          onConfirm={() => void decide()}
          onClose={() => setDeciding(null)}
        />
      )}
      {fallback && <JoinLinkDialog link={fallback} onClose={() => setFallback(null)} />}
    </>
  )
}
