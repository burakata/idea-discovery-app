import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { ApiError, type ErrorKey } from '../api/client'
import { ParticipantRow, type AvatarTone } from '../components/Avatar'
import { Button } from '../components/Button'
import { Empty, NoticeBox } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { Select, TextArea } from '../components/Field'
import { Icon } from '../components/Icon'
import { MessageBubble } from '../components/MessageBubble'
import { Pill } from '../components/Pill'
import type { ConversationSummary, Room } from '../state/context'
import { conversationControls, hasDiscussion, participantRows, roomPath, shownConversation } from '../state/roomRules'
import { useRoomSync } from '../state/roomSync'
import { useStore } from '../state/store'
import { useConversationFeed } from '../state/useConversationFeed'
import { fill, useT } from '../strings'
import { useDemoT } from '../strings/demo'
import styles from './Discussion.module.css'

// The API's limit on a message's length; the text box stops there and a count shows near it.
const MAX_LENGTH = 4000
const COUNT_FROM = 3500

// Enter sends on a desktop (a fine pointer or a wide window, the breakpoint the shell uses);
// on a phone Enter is a new line and the Send button sends.
const sendsOnEnter = () => window.matchMedia('(pointer: fine), (min-width: 900px)').matches

// The demo's scripted assistant answers within seconds, so its thread looks again sooner.
const DEMO_POLL_MS = 1000

// The discussion, the same screen in both builds.
export default function Discussion() {
  const room = useOutletContext<Room>()
  return hasDiscussion(room) ? <Thread room={room} /> : <Navigate to={roomPath(room.id)} replace />
}

function actionKey(failure: unknown): ErrorKey {
  return failure instanceof ApiError ? failure.key : 'generic'
}

function Thread({ room }: { room: Room }) {
  const store = useStore()
  const { me } = store
  const { t, time, translationOf } = useT()
  // The demo's own text (scripted tag, simulated notice) only exists in the demo build.
  const demo = __DEMO__ ? useDemoT() : null
  const [params, setParams] = useSearchParams()
  const { feed, state, conversations, number } = useConversationFeed(
    room.id,
    room.conversations,
    params.get('c'),
    store,
    __DEMO__ ? DEMO_POLL_MS : undefined,
  )

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  // Both belong to one conversation, so neither shows above another.
  const [sendError, setSendError] = useState<{ number: number; key: ErrorKey } | null>(null)
  const [refused, setRefused] = useState<number | null>(null)
  // The conversation the unsent text was typed for.
  const [draftFrom, setDraftFrom] = useState<number | null>(null)
  const [gone, setGone] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const seen = useRef<Set<string> | null>(null)
  const sync = useRoomSync()
  const [showPeople, setShowPeople] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<ErrorKey | null>(null)
  const endRef = useRef<HTMLLIElement>(null)

  const messages = state?.messages ?? []
  const lastMessage = messages[messages.length - 1]
  const isConsultant = me?.isConsultant === true
  const controls = conversationControls({ isConsultant }, { ...room, conversations }, number)
  const shown = conversations.find((conversation) => conversation.number === number)
  const nextNumber = Math.max(...conversations.map((conversation) => conversation.number)) + 1
  const noneActive = !conversations.some((conversation) => conversation.state === 'active')

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  // The sidebar and the participants follow the list this screen keeps up to date.
  const polled = state?.conversations
  useEffect(() => {
    if (polled) sync(polled)
  }, [polled, sync])

  // Announces only what arrives after the first read of a conversation, and not own messages.
  const loaded = state?.loaded === true
  useEffect(() => {
    if (!loaded) {
      seen.current = null
      return
    }
    if (!seen.current) {
      seen.current = new Set(messages.map((message) => message.id))
      return
    }
    const known = seen.current
    const fresh = messages.filter((message) => !known.has(message.id))
    fresh.forEach((message) => known.add(message.id))
    const other = fresh.filter((message) => message.authorId !== me?.id).at(-1)
    if (other) setAnnouncement(fill(t.discussion.newMessage, { name: other.authorRole === 'assistant' ? t.roles.assistant : other.authorName }))
  }, [loaded, messages, me?.id, t])

  const numberText = (value: number) => fill(t.room.conversation, { number: String(value) })

  const entryLabel = (conversation: ConversationSummary) =>
    `${numberText(conversation.number)} · ${
      conversation.state === 'active'
        ? t.room.active
        : conversation.finishedAt
          ? fill(t.room.finishedOn, { date: time(conversation.finishedAt) })
          : t.room.finished
    }`

  // The address names a conversation only when it is not the one shown by default.
  const choose = (value: number) => {
    const next = new URLSearchParams(params)
    if (value === shownConversation(conversations)?.number) next.delete('c')
    else next.set('c', String(value))
    setParams(next, { replace: true })
  }

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text || sending || !feed || draft.length > MAX_LENGTH) return
    setSending(true)
    setSendError(null)
    try {
      feed.add(await store.postMessage(room.id, text))
      setDraft('')
      setDraftFrom(null)
      // Look again at once, so a message never sits under a conversation just finished.
      feed.refresh()
    } catch (failure) {
      // The typed text stays. A 404 sends the person to their list. A 409 says the
      // conversation was finished meanwhile: the text stays, read-only, with a notice.
      if (failure instanceof ApiError && failure.status === 404) setGone(true)
      else if (failure instanceof ApiError && failure.status === 409) {
        setRefused(number)
        feed.refresh()
      } else setSendError({ number, key: actionKey(failure) })
    } finally {
      setSending(false)
    }
  }

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && sendsOnEnter()) {
      event.preventDefault()
      void submit()
    }
  }

  const run = async (work: () => Promise<unknown>, done: () => void) => {
    if (busy) return
    setBusy(true)
    setActionError(null)
    try {
      await work()
      done()
      feed?.refresh()
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 404) setGone(true)
      setActionError(actionKey(failure))
      // The state may differ from what is shown: look again.
      if (failure instanceof ApiError && failure.status === 409) feed?.refresh()
    } finally {
      setBusy(false)
    }
  }

  const finish = () =>
    run(
      () => store.finishConversation(room.id),
      () => setFinishing(false),
    )

  // The new conversation becomes the one shown, unless the address names another.
  const start = () =>
    run(
      () => store.startConversation(room.id),
      () => setParams(new URLSearchParams(), { replace: true }),
    )

  // Unsent text that cannot go where it was written: shown read-only, or carried to another
  // conversation, always with the notice.
  const hasDraft = draft.trim() !== ''
  // Only where the text was typed: in another conversation it waits for the writer's return.
  const stranded = hasDraft && draftFrom === number && (!controls.canWrite || refused === number)
  const tooLong = draft.length > MAX_LENGTH
  const carried = hasDraft && !stranded && draftFrom !== null && draftFrom !== number
  const newer = shownConversation(conversations)
  const newerNumber = newer && newer.state === 'active' && newer.number !== number ? newer.number : null
  const showSend = sendError?.number === number ? sendError.key : null

  if (gone || state?.gone) return <Navigate to="/" replace />

  const waitingForReply = controls.canWrite && !isConsultant && lastMessage?.authorId === me?.id

  const participants = (
    <>
      <ul>
        {participantRows(room).map((row) => (
          <ParticipantRow
            key={row.userId}
            name={row.name}
            role={t.roles[row.role]}
            tone={row.userId === me?.id ? 'mine' : row.role}
          />
        ))}
      </ul>
      {demo && <NoticeBox title={demo.discussion.simulatedTitle}>{demo.discussion.simulatedBody}</NoticeBox>}
    </>
  )

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h1>
              {numberText(number)}
              {shown && (
                <Pill tone={shown.state === 'active' ? 'green' : 'neutral'}>
                  {shown.state === 'active' ? t.room.active : t.room.finished}
                </Pill>
              )}
            </h1>
            {shown?.state === 'active' && <p>{t.discussion.sub}</p>}
          </div>
          <button
            type="button"
            className={styles.peopleButton}
            aria-label={t.discussion.participants}
            onClick={() => setShowPeople(true)}
          >
            <Icon name="people" />
            <span>{t.discussion.participants}</span>
            <span className={styles.peopleCount}>{participantRows(room).length}</span>
          </button>
        </header>

        {(conversations.length > 1 || controls.canFinish || controls.canStart) && (
          <div className={styles.bar}>
            {conversations.length > 1 && (
              <div className={styles.picker}>
                <label htmlFor="conversation-picker">{t.discussion.pickLabel}</label>
                <Select
                  id="conversation-picker"
                  value={number}
                  onChange={(event) => choose(Number(event.target.value))}
                >
                  {[...conversations]
                    .sort((a, b) => b.number - a.number)
                    .map((conversation) => (
                      <option key={conversation.number} value={conversation.number}>
                        {entryLabel(conversation)}
                      </option>
                    ))}
                </Select>
              </div>
            )}
            {controls.canFinish && (
              <Button
                size="sm"
                onClick={() => {
                  setActionError(null)
                  setFinishing(true)
                }}
              >
                {t.discussion.finish}
              </Button>
            )}
            {controls.canStart && (
              <Button variant="primary" size="sm" icon="add" disabled={busy} onClick={() => void start()}>
                {fill(t.discussion.start, { number: String(nextNumber) })}
              </Button>
            )}
          </div>
        )}

        {newerNumber !== null && (
          <p className={styles.newer}>
            {t.discussion.newerTitle}{' '}
            <Link to={roomPath(room.id, 'discussion')} replace>
              {fill(t.discussion.newerGo, { number: String(newerNumber) })}
            </Link>
          </p>
        )}

        {/* Phones only: on desktop the fuller notice sits in the participants panel. */}
        {demo && (
          <p className={styles.simulated}>
            <Icon name="info" size={16} />
            {demo.discussion.simulatedTitle}
          </p>
        )}

        {state?.retrying && (
          <p className={styles.retrying} role="status">
            {t.discussion.retrying}
          </p>
        )}
        {actionError && !finishing && (
          <div className={styles.alert} role="alert">
            <NoticeBox tone="amber">{t.errors[actionError]}</NoticeBox>
          </div>
        )}

        <p className={styles.visuallyHidden} role="status" aria-live="polite">
          {announcement}
        </p>

        <ul className={styles.thread}>
          {!state?.loaded && (
            <li>
              <Empty>{t.discussion.loading}</Empty>
            </li>
          )}
          {state?.loaded && messages.length === 0 && (
            <li>
              <Empty>{shown?.state === 'finished' ? t.discussion.emptyFinished : t.discussion.empty}</Empty>
            </li>
          )}
          {messages.map((message) => {
            const assistant = message.authorRole === 'assistant'
            const tone: AvatarTone = message.authorRole ?? 'owner'
            return (
              <MessageBubble
                key={message.id}
                name={assistant ? t.roles.assistant : message.authorName}
                // A writer who has left has no role; the assistant's name already says what it is.
                role={
                  message.authorLeft
                    ? t.discussion.left
                    : message.authorRole && !assistant
                      ? t.roles[message.authorRole]
                      : undefined
                }
                time={time(message.createdAt)}
                text={message.text}
                tone={tone}
                mine={message.authorId === me?.id}
                tag={message.tag === 'scripted' ? demo?.discussion.scripted : undefined}
                translation={translationOf({ lang: message.language, text: message.text, translation: message.translation ?? undefined })}
              />
            )
          })}
          {waitingForReply && <li className={styles.replyNote}>{t.discussion.replyWillFollow}</li>}
          <li ref={endRef} aria-hidden="true" />
        </ul>

        {controls.canWrite && !stranded ? (
          <form className={styles.composer} onSubmit={submit}>
            {carried && (
              <div className={styles.sendError}>
                <NoticeBox tone="amber">{isConsultant ? t.discussion.draftKeptConsultant : t.discussion.draftKept}</NoticeBox>
              </div>
            )}
            {showSend && (
              <div className={styles.sendError} role="alert">
                <NoticeBox tone="amber">{t.errors[showSend]}</NoticeBox>
              </div>
            )}
            <TextArea
              rows={1}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                setDraftFrom(number)
              }}
              onKeyDown={sendOnEnter}
              placeholder={t.discussion.placeholder}
              aria-label={t.discussion.messageLabel}
            />
            <Button variant="primary" type="submit" icon="send" disabled={!draft.trim() || sending || tooLong}>
              {t.discussion.send}
            </Button>
            {tooLong && (
              <div className={styles.sendError} role="alert">
                <NoticeBox tone="amber">{t.errors.messageTooLong}</NoticeBox>
              </div>
            )}
            {draft.length >= COUNT_FROM && (
              <p className={styles.count}>{fill(t.discussion.charCount, { count: String(draft.length), max: String(MAX_LENGTH) })}</p>
            )}
          </form>
        ) : (
          <div className={styles.finished}>
            {stranded ? (
              <>
                <NoticeBox tone="amber">{isConsultant ? t.discussion.draftKeptConsultant : t.discussion.draftKept}</NoticeBox>
                <TextArea readOnly value={draft} aria-label={t.discussion.messageLabel} />
              </>
            ) : (
              <NoticeBox>
                {noneActive
                  ? isConsultant
                    ? t.discussion.finishedNoneConsultant
                    : t.discussion.finishedWaiting
                  : t.discussion.finishedNote}
              </NoticeBox>
            )}
          </div>
        )}
      </section>

      <aside className={styles.side}>
        <h2>{t.discussion.participants}</h2>
        {participants}
      </aside>

      {showPeople && (
        <div className={styles.scrim} onClick={() => setShowPeople(false)}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-label={t.discussion.participants}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.sheetHead}>
              <h2>{t.discussion.participants}</h2>
              <Button variant="quiet" size="sm" icon="close" onClick={() => setShowPeople(false)}>
                {t.discussion.close}
              </Button>
            </div>
            {participants}
          </div>
        </div>
      )}

      {finishing && (
        <Dialog
          title={fill(t.discussion.finishTitle, { number: String(number) })}
          onClose={() => setFinishing(false)}
          closeLabel={t.discussion.close}
        >
          <div className={styles.dialogBody}>
            <p>{t.discussion.finishBody}</p>
            {actionError && (
              <div role="alert">
                <NoticeBox tone="amber">{t.errors[actionError]}</NoticeBox>
              </div>
            )}
            <div className={styles.dialogActions}>
              <Button onClick={() => setFinishing(false)} data-autofocus>
                {t.discussion.cancel}
              </Button>
              <Button variant="primary" disabled={busy} onClick={() => void finish()}>
                {t.discussion.finishConfirm}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  )
}
