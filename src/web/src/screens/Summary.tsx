import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Empty } from '../components/Card'
import { TextArea } from '../components/Field'
import { Icon, type IconName } from '../components/Icon'
import { TranslationLine } from '../components/MessageBubble'
import { Pill } from '../components/Pill'
import { StatementCard, type ReactionView } from '../components/StatementCard'
import type { Project, StatementGroup } from '../projects/types'
import { useStore } from '../state/store'
import type { Statement } from '../state/types'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Summary.module.css'

export default function Summary() {
  const project = useOutletContext<Project>()
  const { state, viewer, dispatch } = useStore()
  const { t, lang, pick, personName, translationOf } = useT()
  const navigate = useNavigate()

  const roomId = project.id
  const room = state.rooms[roomId]

  // On phones the groups collapse; on desktop all three are always open.
  // A short group starts open, so an owner does not miss it.
  const [open, setOpen] = useState<Record<StatementGroup, boolean>>(() => {
    const isShort = (group: StatementGroup) =>
      room.statements.filter((statement) => statement.group === group).length <= 4
    return { confirmed: isShort('confirmed'), early: true, open: isShort('open') }
  })
  const [correcting, setCorrecting] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<'early' | 'open' | null>(null)
  const [text, setText] = useState('')

  const isConsultant = viewer.role === 'consultant'
  const placeholderLine = (
    <TranslationLine label={t.discussion.translated} placeholder={t.discussion.translationPlaceholder} />
  )

  const groups: { key: StatementGroup; icon: IconName; title: string; help: string }[] = [
    { key: 'confirmed', icon: 'confirmed', title: t.summary.confirmed, help: t.summary.confirmedHelp },
    { key: 'early', icon: 'early', title: t.summary.early, help: t.summary.earlyHelp },
    { key: 'open', icon: 'question', title: t.summary.open, help: t.summary.openHelp },
  ]

  const closeForms = () => {
    setCorrecting(null)
    setEditing(null)
    setAdding(null)
    setText('')
  }

  const react = (statement: Statement, kind: 'right' | 'notRight') => {
    // Reactions carry a name, so a person who has not joined is asked for one first.
    if (!viewer.joined) {
      navigate(`/rooms/${roomId}/join?next=summary`)
      return
    }
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
    const lines = [`${t.app.name} — ${pick(project.name).text}`, t.summary.title, '']
    for (const group of groups) {
      lines.push(group.title.toLocaleUpperCase(lang), group.help)
      const statements = room.statements.filter((statement) => statement.group === group.key)
      if (statements.length === 0) lines.push(`  ${t.summary.empty}`)
      for (const statement of statements) {
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
    link.download = `${project.id}-shared-summary.txt`
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
        note={picked.missing ? placeholderLine : undefined}
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
    <Page>
      <PageTitle
        title={t.summary.title}
        sub={t.summary.sub}
        aside={
          isConsultant && (
            <Button icon="download" onClick={exportSummary}>
              {c.summary.export}
            </Button>
          )
        }
      />
      <div className={styles.groups}>
        {groups.map((group) => {
          const statements = room.statements.filter((statement) => statement.group === group.key)
          return (
            <section key={group.key} className={`${styles.group} ${styles[group.key]}`}>
              <h2 className={styles.heading}>
                <button
                  type="button"
                  className={styles.head}
                  aria-expanded={open[group.key]}
                  onClick={() => setOpen({ ...open, [group.key]: !open[group.key] })}
                >
                  <span className={styles.icon}>
                    <Icon name={group.icon} />
                  </span>
                  <span className={styles.title}>{group.title}</span>
                  <Pill tone="neutral">{statements.length}</Pill>
                  <span className={styles.chevron}>
                    <Icon name="chevron" />
                  </span>
                </button>
              </h2>
              <div className={open[group.key] ? styles.body : styles.bodyClosed}>
                <p className={styles.help}>{group.help}</p>
                {statements.length > 0 ? (
                  <ul className={styles.items}>{statements.map(renderStatement)}</ul>
                ) : (
                  <Empty>{t.summary.empty}</Empty>
                )}
                {isConsultant && group.key !== 'confirmed' && (
                  <div className={styles.add}>{renderAdd(group.key)}</div>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
