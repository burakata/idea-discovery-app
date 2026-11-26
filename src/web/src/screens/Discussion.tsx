import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useOutletContext } from 'react-router-dom'
import { ParticipantRow } from '../components/Avatar'
import { Button } from '../components/Button'
import { Empty, NoticeBox } from '../components/Card'
import { TextArea } from '../components/Field'
import { Icon } from '../components/Icon'
import { MessageBubble } from '../components/MessageBubble'
import type { Project } from '../projects/types'
import { useDemoStore } from '../state/demoStore'
import { roomPath } from '../state/roomRules'
import { useT } from '../strings'
import styles from './Discussion.module.css'

export default function Discussion() {
  const project = useOutletContext<Project>()
  const { state, viewer, send } = useDemoStore()
  const { t, time, personName, translationOf } = useT()
  const [draft, setDraft] = useState('')
  const [showPeople, setShowPeople] = useState(false)
  const endRef = useRef<HTMLLIElement>(null)

  const room = state.rooms[project.id]
  const lastMessage = room.messages[room.messages.length - 1]

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [room.messages.length])

  if (!viewer.joined) return <Navigate to={`${roomPath(project.id, 'join')}?next=discussion`} replace />

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const text = draft.trim()
    if (!text) return
    send(project.id, text)
    setDraft('')
  }

  const sendOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  const waitingForReply = viewer.role === 'owner' && lastMessage?.authorId === viewer.id

  const participants = (
    <>
      <ul>
        {project.participants.map(({ id }) => {
          const person = state.people[id]
          const role = person.role === 'assistant' ? t.discussion.assistantRole : t.roles[person.role]
          return (
            <ParticipantRow
              key={id}
              name={personName(person)}
              role={person.joined ? role : `${role} · ${t.discussion.notJoined}`}
              tone={person.id === viewer.id ? 'mine' : person.role}
            />
          )
        })}
      </ul>
      <NoticeBox title={t.discussion.simulatedTitle}>{t.discussion.simulatedBody}</NoticeBox>
    </>
  )

  return (
    <div className={styles.layout}>
      <section className={styles.panel}>
        <header className={styles.head}>
          <div>
            <h1>{t.discussion.title}</h1>
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
            <span className={styles.peopleCount}>{project.participants.length}</span>
          </button>
        </header>

        {/* Phones only: on desktop the fuller notice sits in the participants panel. */}
        <p className={styles.simulated}>
          <Icon name="info" size={16} />
          {t.discussion.simulatedTitle}
        </p>

        <ul className={styles.thread} aria-live="polite">
          {room.messages.length === 0 && (
            <li>
              <Empty>{t.discussion.empty}</Empty>
            </li>
          )}
          {room.messages.map((message) => {
            const author = state.people[message.authorId]
            return (
              <MessageBubble
                key={message.id}
                name={personName(author)}
                role={author.role === 'assistant' ? undefined : t.roles[author.role]}
                time={time(message.at)}
                text={message.text}
                tone={author.role}
                mine={author.id === viewer.id}
                tag={message.scripted ? t.discussion.scripted : undefined}
                translation={translationOf(message)}
              />
            )
          })}
          {waitingForReply && <li className={styles.replyNote}>{t.discussion.replyWillFollow}</li>}
          <li ref={endRef} aria-hidden="true" />
        </ul>

        <form className={styles.composer} onSubmit={submit}>
          <TextArea
            rows={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={sendOnEnter}
            placeholder={t.discussion.placeholder}
            aria-label={t.discussion.messageLabel}
          />
          <Button variant="primary" type="submit" icon="send" disabled={!draft.trim()}>
            {t.discussion.send}
          </Button>
        </form>
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
    </div>
  )
}
