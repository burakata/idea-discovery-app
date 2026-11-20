import { useState, type ReactNode } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty } from '../components/Card'
import { Switch, TextArea, TextInput } from '../components/Field'
import { JobFlowStep } from '../components/JobFlow'
import { TranslationLine } from '../components/MessageBubble'
import { Pill } from '../components/Pill'
import { scriptLine } from '../demo/script'
import type { Project } from '../projects/types'
import { useStore } from '../state/store'
import type { QueueItem, Source } from '../state/types'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Queue.module.css'

export default function Queue() {
  const project = useOutletContext<Project>()
  const { state, dispatch } = useStore()
  const { t, lang, pick, personName, translationOf } = useT()
  const [editing, setEditing] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [what, setWhat] = useState('')

  const roomId = project.id
  const room = state.rooms[roomId]
  const scriptDone = !scriptLine(room.scriptIndex)
  const placeholderLine = (
    <TranslationLine label={t.discussion.translated} placeholder={t.discussion.translationPlaceholder} />
  )

  const startEdit = (item: QueueItem) => {
    setEditing(item.id)
    if (item.kind === 'message') setText(item.text)
    else if (item.kind === 'statement') setText(pick(item.text).text)
    else {
      setText(pick(item.who).text)
      setWhat(pick(item.what).text)
    }
  }

  const source = ({ saidBy, quote }: Source) => (
    <p className={styles.source}>
      <span>{c.queue.restsOn}</span> {personName(state.people[saidBy])}: “{quote}”
    </p>
  )

  // The other language of a proposal, so Burak can check both before approving.
  const otherLanguage = (value: { en?: string; tr?: string }) => {
    const other = value[lang === 'en' ? 'tr' : 'en']
    if (pick(value).missing || !other) return placeholderLine
    // The assistant wrote both versions, so this one is named, not called a translation.
    return <TranslationLine label={c.languages[lang === 'en' ? 'tr' : 'en']} text={other} placeholder="" />
  }

  const renderItem = (item: QueueItem) => {
    let label: string
    let body: ReactNode

    if (item.kind === 'message') {
      label = c.queue.draftMessage
      const translation = translationOf(item)
      body = (
        <>
          <p className={styles.meta}>
            {c.queue.replyTo} {personName(state.people[item.replyTo])}
          </p>
          <div className={styles.draft}>
            <p>{item.text}</p>
            {translation && <TranslationLine {...translation} />}
          </div>
        </>
      )
    } else if (item.kind === 'statement') {
      const replaced = room.statements.find((statement) => statement.id === item.replaces)
      label = replaced
        ? replaced.group === 'open' && item.group === 'early'
          ? c.queue.answeredQuestion
          : c.queue.rewordedStatement
        : item.group === 'early'
          ? c.queue.proposedStatement
          : c.queue.proposedQuestion
      body = (
        <>
          {replaced && (
            <>
              <p className={styles.meta}>{c.queue.now}</p>
              <p className={styles.current}>{pick(replaced.text).text}</p>
              <p className={styles.meta}>{c.queue.proposed}</p>
            </>
          )}
          <div className={styles.draft}>
            <p>{pick(item.text).text}</p>
            {otherLanguage(item.text)}
          </div>
          {source(item.source)}
        </>
      )
    } else {
      label = c.queue.jobFlowChange
      const current = room.jobFlow.find((step) => step.id === item.stepId)
      body = (
        <>
          <div className={styles.change}>
            {current && (
              <div>
                <p className={styles.meta}>{c.queue.now}</p>
                <ul>
                  <JobFlowStep
                    step={{ ...current, who: pick(current.who).text, what: pick(current.what).text }}
                    unknownLabel={t.idea.unknownStep}
                  />
                </ul>
              </div>
            )}
            <div>
              <p className={styles.meta}>{c.queue.proposed}</p>
              <ul>
                <JobFlowStep
                  step={{
                    id: item.id,
                    icon: current?.icon ?? 'people',
                    who: pick(item.who).text,
                    what: pick(item.what).text,
                    unknown: item.unknown ?? false,
                    note: otherLanguage(item.what),
                  }}
                  unknownLabel={t.idea.unknownStep}
                />
                {item.stillUnknown && (
                  <JobFlowStep
                    step={{
                      id: `${item.id}-unknown`,
                      icon: current?.icon ?? 'people',
                      who: pick(item.stillUnknown.who).text,
                      what: pick(item.stillUnknown.what).text,
                      unknown: true,
                    }}
                    unknownLabel={t.idea.unknownStep}
                  />
                )}
              </ul>
            </div>
          </div>
          {item.source && source(item.source)}
        </>
      )
    }

    return (
      <li key={item.id}>
        <Card>
          <div className={styles.pills}>
            <Pill>{label}</Pill>
            {item.kind === 'message' && <Pill tone="amber">{c.queue.scripted}</Pill>}
          </div>
          {editing === item.id ? (
            <div className={styles.form}>
              {item.kind === 'jobFlow' ? (
                <>
                  <label htmlFor={`who-${item.id}`}>{c.queue.who}</label>
                  <TextInput id={`who-${item.id}`} value={text} onChange={(event) => setText(event.target.value)} />
                  <label htmlFor={`what-${item.id}`}>{c.queue.what}</label>
                  <TextArea id={`what-${item.id}`} value={what} onChange={(event) => setWhat(event.target.value)} />
                </>
              ) : (
                <TextArea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  aria-label={label}
                  rows={3}
                  autoFocus
                />
              )}
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!text.trim()}
                  onClick={() => {
                    dispatch({
                      type: 'editItem',
                      roomId,
                      itemId: item.id,
                      lang,
                      text: text.trim(),
                      what: what.trim(),
                    })
                    setEditing(null)
                  }}
                >
                  {c.queue.save}
                </Button>
                <Button variant="quiet" size="sm" onClick={() => setEditing(null)}>
                  {c.queue.cancel}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {body}
              <div className={styles.actions}>
                <Button
                  variant="primary"
                  size="sm"
                  icon="check"
                  onClick={() => dispatch({ type: 'approve', roomId, itemId: item.id })}
                >
                  {c.queue.approve}
                </Button>
                <Button size="sm" icon="edit" onClick={() => startEdit(item)}>
                  {c.queue.edit}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  icon="close"
                  onClick={() => dispatch({ type: 'reject', roomId, itemId: item.id })}
                >
                  {c.queue.reject}
                </Button>
              </div>
            </>
          )}
        </Card>
      </li>
    )
  }

  return (
    <Page narrow>
      <PageTitle
        title={c.queue.title}
        sub={c.queue.sub}
        count={{ value: room.queue.length, label: c.nav.waiting }}
      />

      <Card className={styles.auto}>
        <div>
          <strong>{c.queue.autoTitle}</strong>
          <p>{c.queue.autoBody}</p>
        </div>
        <Switch
          checked={room.autoReply}
          onChange={(on) => dispatch({ type: 'autoSwitch', roomId, on })}
          label={c.queue.autoTitle}
        />
      </Card>

      {room.queue.length > 0 ? (
        <ul className={styles.items}>{room.queue.map(renderItem)}</ul>
      ) : (
        <Empty>
          {c.queue.empty} {scriptDone ? c.queue.scriptDone : c.queue.emptyHint}
        </Empty>
      )}
      {room.queue.length > 0 && scriptDone && <p className={styles.done}>{c.queue.scriptDone}</p>}
    </Page>
  )
}
