import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
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
import { useStore } from '../state/store'
import { useConversationFeed } from '../state/useConversationFeed'
import { fill, useT } from '../strings'
import { useDemoT } from '../strings/demo'
import styles from './Discussion.module.css'

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
  const [sendError, setSendError] = useState<ErrorKey | null>(null)
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
    if (!text || sending || !feed) return
    setSending(true)
    setSendError(null)
    try {
      feed.add(await store.postMessage(room.id, text))
      setDraft('')
    } catch (failure) {
      // The typed text stays. A 409 says the conversation was finished meanwhile: read it again.
      setSendError(actionKey(failure))
      if (failure instanceof ApiError && failure.status === 409) feed?.refresh()
    } finally {
      setSending(false)
    }
  }

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
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
            <p>{t.discussion.sub}</p>
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

        <div className={styles.bar}>
          <div className={styles.picker}>
            <Select
              aria-label={t.discussion.pickLabel}
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
          {controls.canFinish && (
            <Button
              onClick={() => {
                setActionError(null)
                setFinishing(true)
              }}
            >
              {t.discussion.finish}
            </Button>
          )}
          {controls.canStart && (
            <Button variant="primary" icon="add" disabled={busy} onClick={() => void start()}>
              {fill(t.discussion.start, { number: String(nextNumber) })}
            </Button>
          )}
        </div>

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

        <ul className={styles.thread} aria-live="polite">
          {!state?.loaded && (
            <li>
              <Empty>{t.discussion.loading}</Empty>
            </li>
          )}
          {state?.loaded && messages.length === 0 && (
            <li>
              <Empty>{t.discussion.empty}</Empty>
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

        {controls.canWrite ? (
          <form className={styles.composer} onSubmit={submit}>
            {sendError && (
              <div className={styles.sendError} role="alert">
                <NoticeBox tone="amber">{t.errors[sendError]}</NoticeBox>
              </div>
            )}
            <TextArea
              rows={1}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={sendOnEnter}
              placeholder={t.discussion.placeholder}
              aria-label={t.discussion.messageLabel}
            />
            <Button variant="primary" type="submit" icon="send" disabled={!draft.trim() || sending}>
              {t.discussion.send}
            </Button>
          </form>
        ) : (
          <div className={styles.finished}>
            <NoticeBox>
              {!isConsultant && noneActive ? t.discussion.finishedWaiting : t.discussion.finishedNote}
            </NoticeBox>
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
