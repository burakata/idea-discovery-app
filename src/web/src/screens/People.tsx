import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { ApiError, type ConsultantErrorKey } from '../api/client'
import { Page, PageTitle } from '../components/AppShell'
import { Avatar } from '../components/Avatar'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox, SectionTitle } from '../components/Card'
import { Select, TextInput } from '../components/Field'
import { Pill } from '../components/Pill'
import { DEFAULT_LANG, LANG_LABELS, LANGS, type Lang } from '../languages'
import type { CopyResult, Invitation, Member, ProjectDetails } from '../state/context'
import { useStore } from '../state/store'
import { fill, useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { demoPeople } from '../strings/demo'
import { canCopySignInLink, canRemove, copiedMessage, inviteMessage } from './peopleRules'
import { AskingToJoin } from './AskingToJoin'
import { LinkDialog, RemoveDialog, SessionsDialog } from './PeopleDialogs'
import styles from './People.module.css'

const p = c.people

type Note = { tone: 'info' | 'amber'; text: string }

const stateTone = { open: 'info', accepted: 'green', revoked: 'neutral', expired: 'neutral' } as const

const keyOf = (failure: unknown): ConsultantErrorKey => (failure instanceof ApiError ? failure.consultantKey : 'generic')
const errorNote = (failure: unknown): Note => ({ tone: 'amber', text: c.errors[keyOf(failure)] })

// Burak's screen for one project's people: who is in it, who is invited, and what
// he can do about each. English only; emails appear here and nowhere else.
export default function People() {
  const { projectId = '' } = useParams()
  const store = useStore()
  const { time, pick } = useT()
  const [project, setProject] = useState<ProjectDetails | null>(null)
  const [invitations, setInvitations] = useState<Invitation[] | null>(null)
  const [gone, setGone] = useState(false)
  const [loadError, setLoadError] = useState<ConsultantErrorKey | null>(null)
  const [memberNote, setMemberNote] = useState<Note | null>(null)
  const [inviteNote, setInviteNote] = useState<Note | null>(null)
  const [listNote, setListNote] = useState<Note | null>(null)
  const [sessionsOf, setSessionsOf] = useState<Member | null>(null)
  const [removing, setRemoving] = useState<{
    member: Member
    busy: boolean
    error: ConsultantErrorKey | null
  } | null>(null)
  // The one place a link is ever held: only if the browser would not copy it, and
  // only while its dialog is open.
  const [fallback, setFallback] = useState<{ name: string; link: string } | null>(null)

  const reload = async () => {
    try {
      const [details, invites] = await Promise.all([store.getProject(projectId), store.listInvitations(projectId)])
      setProject(details)
      setInvitations(invites)
      setLoadError(null)
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) setGone(true)
      else setLoadError(keyOf(failure))
    }
  }

  useEffect(() => {
    void reload()
    // Loaded once per project: the store's functions change identity as the demo state changes.
  }, [projectId])

  if (gone) return <Navigate to="/" replace />

  const afterCopy = (result: CopyResult, name: string, show: (note: Note) => void) => {
    const text = copiedMessage(result, name)
    // In the demo the copied link is a sample, and the note says so.
    if (text) show({ tone: 'info', text: __DEMO__ ? `${text} ${demoPeople.sampleLink}` : text })
    else if (!result.copied) setFallback({ name, link: result.link })
  }

  const copyMember = async (member: Member) => {
    setMemberNote(null)
    try {
      afterCopy(await store.copySignInLink(member.userId), member.displayName, setMemberNote)
    } catch (failure) {
      setMemberNote(errorNote(failure))
    }
  }

  const copyInvitation = async (invitation: Invitation) => {
    setListNote(null)
    try {
      afterCopy(await store.copyInvitationLink(invitation.id), invitation.displayName, setListNote)
    } catch (failure) {
      setListNote(errorNote(failure))
      await reload()
    }
  }

  const revoke = async (invitation: Invitation) => {
    setListNote(null)
    try {
      await store.revokeInvitation(invitation.id)
      setListNote({ tone: 'info', text: p.invitationRevoked })
    } catch (failure) {
      setListNote(errorNote(failure))
    }
    await reload()
  }

  const remove = async () => {
    if (!removing) return
    setRemoving({ ...removing, busy: true, error: null })
    try {
      await store.removeMember(projectId, removing.member.userId)
      setMemberNote({ tone: 'info', text: fill(p.removed, { name: removing.member.displayName }) })
      setRemoving(null)
      await reload()
    } catch (failure) {
      setRemoving({ ...removing, busy: false, error: keyOf(failure) })
    }
  }

  const myId = store.me?.id

  return (
    <Page>
      <PageTitle
        title={p.title}
        sub={project ? pick(project.title).text : undefined}
        aside={
          <div className={styles.titleActions}>
            <Button variant="quiet" icon="back" to="/">
              {p.back}
            </Button>
            <Button icon="edit" to={`/projects/${encodeURIComponent(projectId)}/edit`}>
              {p.edit}
            </Button>
          </div>
        }
      />
      {__DEMO__ && (
        <div className={styles.block}>
          <NoticeBox>{demoPeople.note}</NoticeBox>
        </div>
      )}
      {loadError && !project && <NoticeBox tone="amber">{c.errors[loadError]}</NoticeBox>}
      {!project && !loadError && <p role="status">{p.loading}</p>}

      {project && (
        <div className={styles.layout}>
          <div className={styles.column}>
            <SectionTitle title={p.members} sub={p.membersSub} />
            <Card>
              <div role="status">{memberNote && <NoticeBox tone={memberNote.tone}>{memberNote.text}</NoticeBox>}</div>
              <ul className={styles.rows}>
                {project.members.map((member) => (
                  <li key={member.userId} className={styles.row}>
                    <div className={styles.who}>
                      <Avatar name={member.displayName} tone={member.role === 'consultant' ? 'consultant' : 'owner'} />
                      <div className={styles.name}>
                        <strong>
                          {member.displayName}
                          {member.userId === myId && <span className={styles.you}> ({p.you})</span>}
                        </strong>
                        <span>{p.roles[member.role]}</span>
                        {member.email && <span className={styles.email}>{member.email}</span>}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      {canCopySignInLink(member, myId) && (
                        <Button size="sm" icon="send" onClick={() => void copyMember(member)}>
                          {p.copySignInLink}
                        </Button>
                      )}
                      <Button size="sm" icon="people" onClick={() => setSessionsOf(member)}>
                        {p.signIns}
                      </Button>
                      {canRemove(member, myId) && (
                        <Button
                          size="sm"
                          icon="remove"
                          className={styles.danger}
                          onClick={() => setRemoving({ member, busy: false, error: null })}
                        >
                          {p.remove}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <AskingToJoin projectId={projectId} onApproved={reload} />
          </div>

          <div className={styles.column}>
            <SectionTitle title={p.inviteTitle} sub={p.inviteSub} />
            <InviteForm projectId={projectId} note={inviteNote} setNote={setInviteNote} onSent={reload} />

            <SectionTitle title={p.invitations} sub={p.invitationsSub} />
            <div role="status">{listNote && <NoticeBox tone={listNote.tone}>{listNote.text}</NoticeBox>}</div>
            {invitations?.length === 0 && <Empty>{p.noInvitations}</Empty>}
            <ul className={styles.invitations}>
              {invitations?.map((invitation) => (
                <li key={invitation.id}>
                  <Card className={styles.invitation}>
                    <div className={styles.name}>
                      <strong>{invitation.displayName}</strong>
                      <span className={styles.email}>{invitation.email}</span>
                      <span>
                        {LANG_LABELS[invitation.language].full} · {fill(p.sentOn, { time: time(invitation.createdAt) })}
                      </span>
                    </div>
                    <Pill tone={stateTone[invitation.state]}>{p.states[invitation.state]}</Pill>
                    {invitation.state === 'open' && (
                      <div className={styles.actions}>
                        <Button size="sm" icon="send" onClick={() => void copyInvitation(invitation)}>
                          {p.copyLink}
                        </Button>
                        <Button size="sm" icon="close" onClick={() => void revoke(invitation)}>
                          {p.revoke}
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {sessionsOf && <SessionsDialog member={sessionsOf} onClose={() => setSessionsOf(null)} />}
      {removing && (
        <RemoveDialog
          member={removing.member}
          busy={removing.busy}
          error={removing.error}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        />
      )}
      {fallback && <LinkDialog name={fallback.name} link={fallback.link} onClose={() => setFallback(null)} />}
    </Page>
  )
}

function InviteForm({
  projectId,
  note,
  setNote,
  onSent,
}: {
  projectId: string
  note: Note | null
  setNote: (note: Note | null) => void
  onSent: () => Promise<void>
}) {
  const { invite } = useStore()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [language, setLanguage] = useState<Lang>(DEFAULT_LANG)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    if (!email.trim() || !name.trim()) {
      setNote({ tone: 'amber', text: p.fieldsMissing })
      return
    }
    setBusy(true)
    setNote(null)
    try {
      const outcome = await invite(projectId, { email: email.trim(), displayName: name.trim(), language })
      setNote(inviteMessage(outcome, email.trim()))
      // The form clears only when the person was invited or added.
      if (outcome.kind !== 'tryLater') {
        setEmail('')
        setName('')
      }
      await onSent()
    } catch (failure) {
      setNote(errorNote(failure))
    }
    setBusy(false)
  }

  return (
    <Card>
      <form className={styles.form} onSubmit={submit} noValidate>
        <label htmlFor="invite-email">{p.emailLabel}</label>
        <TextInput
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="invite-name">{p.nameLabel}</label>
        <TextInput id="invite-name" autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
        <label htmlFor="invite-language">{p.languageLabel}</label>
        <Select
          id="invite-language"
          value={language}
          aria-describedby="invite-language-hint"
          onChange={(event) => setLanguage(event.target.value as Lang)}
        >
          {LANGS.map((lang) => (
            <option key={lang} value={lang}>
              {LANG_LABELS[lang].full}
            </option>
          ))}
        </Select>
        <p id="invite-language-hint" className={styles.hint}>
          {p.languageHint}
        </p>
        <div role="status">{note && <NoticeBox tone={note.tone}>{note.text}</NoticeBox>}</div>
        <div>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? p.inviting : p.inviteSubmit}
          </Button>
        </div>
      </form>
    </Card>
  )
}
