// The demo's abilities on the shared summary: owners' reactions, Burak's confirm, edit,
// remove and add, and the export. They work on the demo store, so this file is left out of
// the api build (see Summary.tsx). The summary itself is SummaryView.
import { useState } from 'react'
import { Button } from '../components/Button'
import { TextArea } from '../components/Field'
import { TranslationLine } from '../components/MessageBubble'
import { StatementCard, type ReactionView } from '../components/StatementCard'
import type { StatementGroup } from '../projects/types'
import type { Room } from '../state/context'
import { useDemoStore } from '../state/demoStore'
import type { Statement } from '../state/types'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { SummaryView } from './SummaryView'
import styles from './Summary.module.css'

export default function DemoSummary({ room: shown }: { room: Room }) {
  const { state, viewer, dispatch } = useDemoStore()
  const { t, lang, pick, personName, translationOf } = useT()

  const roomId = shown.id
  // Read live, not from the loaded room: reactions and edits change while the screen is open.
  const statements = state.rooms[roomId].statements

  const [correcting, setCorrecting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<'early' | 'open' | null>(null)
  const [text, setText] = useState('')

  const isConsultant = viewer.role === 'consultant'

  const closeForms = () => {
    setCorrecting(null)
    setEditing(null)
    setAdding(null)
    setText('')
  }

  const react = (statement: Statement, kind: 'right' | 'notRight') => {
    const mine = statement.reactions.find((reaction) => reaction.personId === viewer.id)
    if (mine?.kind === kind) {
      dispatch({ type: 'react', roomId, statementId: statement.id, kind: null })
    } else if (kind === 'notRight') {
      closeForms()
      setCorrecting(statement.id)
    } else {
      dispatch({ type: 'react', roomId, statementId: statement.id, kind })
    }
  }

  const exportSummary = () => {
    const groups: { key: StatementGroup; title: string; help: string }[] = [
      { key: 'confirmed', title: t.summary.confirmed, help: t.summary.confirmedHelp },
      { key: 'early', title: t.summary.early, help: t.summary.earlyHelp },
      { key: 'open', title: t.summary.open, help: t.summary.openHelp },
    ]
    const lines = [`${t.app.name} — ${pick(shown.title).text}`, t.summary.title, '']
    for (const group of groups) {
      lines.push(group.title.toLocaleUpperCase(lang), group.help)
      const inGroup = statements.filter((statement) => statement.group === group.key)
      if (inGroup.length === 0) lines.push(`  ${t.summary.empty}`)
      for (const statement of inGroup) {
        lines.push(`- ${pick(statement.text).text}`)
        for (const reaction of statement.reactions) {
          const label = reaction.kind === 'right' ? t.summary.right : t.summary.notRight
          const correction = reaction.correction ? ` — ${reaction.correction.text}` : ''
          lines.push(`    ${personName(state.people[reaction.personId])}: ${label}${correction}`)
        }
      }
      lines.push('')
    }
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${roomId}-shared-summary.txt`
    link.click()
    URL.revokeObjectURL(url)
  }

  const renderStatement = (statement: Statement) => {
    const picked = pick(statement.text)
    const mine = statement.reactions.find((reaction) => reaction.personId === viewer.id)

    if (editing === statement.id) {
      return (
        <li key={statement.id} className={styles.form}>
          <TextArea value={text} onChange={(event) => setText(event.target.value)} autoFocus />
          <div className={styles.formActions}>
            <Button
              variant="primary"
              size="sm"
              disabled={!text.trim()}
              onClick={() => {
                dispatch({ type: 'editStatement', roomId, statementId: statement.id, text: text.trim() })
                closeForms()
              }}
            >
              {c.summary.save}
            </Button>
            <Button variant="quiet" size="sm" onClick={closeForms}>
              {c.summary.cancel}
            </Button>
          </div>
        </li>
      )
    }

    const reactions: ReactionView[] = statement.reactions.map((reaction) => {
      const translation = reaction.correction && translationOf(reaction.correction)
      return {
        key: reaction.personId,
        name: personName(state.people[reaction.personId]),
        kind: reaction.kind,
        label: reaction.kind === 'right' ? t.summary.right : t.summary.notRight,
        correction: reaction.correction && (
          <>
            <p>{reaction.correction.text}</p>
            {translation && <TranslationLine {...translation} />}
          </>
        ),
      }
    })

    return (
      <StatementCard
        key={statement.id}
        text={picked.text}
        status={statement.group === 'early' ? t.summary.awaiting : undefined}
        reactions={reactions}
      >
        {!isConsultant && statement.group === 'early' && correcting !== statement.id && (
          <>
            <Button
              size="sm"
              icon="check"
              tone="positive"
              aria-pressed={mine?.kind === 'right'}
              onClick={() => react(statement, 'right')}
            >
              {t.summary.right}
            </Button>
            <Button
              size="sm"
              icon="close"
              tone="negative"
              aria-pressed={mine?.kind === 'notRight'}
              onClick={() => react(statement, 'notRight')}
            >
              {t.summary.notRight}
            </Button>
          </>
        )}
        {correcting === statement.id && (
          <div className={styles.correction}>
            <label htmlFor={`correction-${statement.id}`}>{t.summary.correctionLabel}</label>
            <TextArea
              id={`correction-${statement.id}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t.summary.correctionPlaceholder}
              autoFocus
            />
            <div className={styles.formActions}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  dispatch({
                    type: 'react',
                    roomId,
                    statementId: statement.id,
                    kind: 'notRight',
                    correction: text.trim() || undefined,
                  })
                  closeForms()
                }}
              >
                {t.summary.sendCorrection}
              </Button>
              <Button variant="quiet" size="sm" onClick={closeForms}>
                {t.summary.cancel}
              </Button>
            </div>
          </div>
        )}
        {isConsultant && (
          <>
            {statement.group === 'early' && (
              <Button
                variant="primary"
                size="sm"
                icon="check"
                onClick={() => dispatch({ type: 'confirm', roomId, statementId: statement.id })}
              >
                {c.summary.confirm}
              </Button>
            )}
            <Button
              size="sm"
              icon="edit"
              iconOnly
              onClick={() => {
                closeForms()
                setEditing(statement.id)
                setText(picked.text)
              }}
            >
              {c.summary.edit}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              icon="remove"
              iconOnly
              onClick={() => dispatch({ type: 'removeStatement', roomId, statementId: statement.id })}
            >
              {c.summary.remove}
            </Button>
          </>
        )}
      </StatementCard>
    )
  }

  const renderAdd = (group: 'early' | 'open') =>
    adding === group ? (
      <div className={styles.form}>
        <TextArea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={group === 'early' ? c.summary.statementPlaceholder : c.summary.questionPlaceholder}
          autoFocus
        />
        <div className={styles.formActions}>
          <Button
            variant="primary"
            size="sm"
            disabled={!text.trim()}
            onClick={() => {
              dispatch({ type: 'addStatement', roomId, group, text: text.trim() })
              closeForms()
            }}
          >
            {c.summary.add}
          </Button>
          <Button variant="quiet" size="sm" onClick={closeForms}>
            {c.summary.cancel}
          </Button>
        </div>
      </div>
    ) : (
      <Button
        variant="quiet"
        size="sm"
        icon="add"
        onClick={() => {
          closeForms()
          setAdding(group)
        }}
      >
        {group === 'early' ? c.summary.addStatement : c.summary.addQuestion}
      </Button>
    )

  return (
    <SummaryView
      room={shown}
      statements={statements}
      renderStatement={renderStatement}
      renderAdd={isConsultant ? renderAdd : undefined}
      aside={
        isConsultant && (
          <Button icon="download" onClick={exportSummary}>
            {c.summary.export}
          </Button>
        )
      }
    />
  )
}
