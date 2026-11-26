import { useState, type ReactNode } from 'react'
import { Page, PageTitle } from '../components/AppShell'
import { Empty } from '../components/Card'
import { Icon, type IconName } from '../components/Icon'
import { Pill } from '../components/Pill'
import { StatementCard } from '../components/StatementCard'
import type { StatementGroup } from '../projects/types'
import type { Room } from '../state/context'
import type { Statement } from '../state/types'
import { useT } from '../strings'
import styles from './Summary.module.css'

interface Props {
  room: Room
  // The demo passes its live statements, which change as Burak and the owners work.
  statements?: Statement[]
  // The demo's own cards (reactions, Burak's actions) and add buttons. Without them
  // each statement is a plain card: the real app has no statements until M3.
  renderStatement?: (statement: Statement) => ReactNode
  renderAdd?: (group: 'early' | 'open') => ReactNode
  aside?: ReactNode
}

// The shared summary, the same in both builds: three groups, each with its empty state.
// It knows nothing of the demo; the demo's abilities come in through the props above.
export function SummaryView({ room, statements = room.content.statements, renderStatement, renderAdd, aside }: Props) {
  const { t, pick } = useT()

  // On phones the groups collapse; on desktop all three are always open.
  // A short group starts open, so an owner does not miss it.
  const [open, setOpen] = useState<Record<StatementGroup, boolean>>(() => {
    const isShort = (group: StatementGroup) => statements.filter((statement) => statement.group === group).length <= 4
    return { confirmed: isShort('confirmed'), early: true, open: isShort('open') }
  })

  const groups: { key: StatementGroup; icon: IconName; title: string; help: string }[] = [
    { key: 'confirmed', icon: 'confirmed', title: t.summary.confirmed, help: t.summary.confirmedHelp },
    { key: 'early', icon: 'early', title: t.summary.early, help: t.summary.earlyHelp },
    { key: 'open', icon: 'question', title: t.summary.open, help: t.summary.openHelp },
  ]

  const plainStatement = (statement: Statement) => (
    <StatementCard
      key={statement.id}
      text={pick(statement.text).text}
      status={statement.group === 'early' ? t.summary.awaiting : undefined}
    />
  )

  return (
    <Page>
      <PageTitle title={t.summary.title} sub={t.summary.sub} aside={aside} />
      {statements.length === 0 && <Empty>{t.summary.nothingShared}</Empty>}
      <div className={styles.groups}>
        {groups.map((group) => {
          const inGroup = statements.filter((statement) => statement.group === group.key)
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
                  <Pill tone="neutral">{inGroup.length}</Pill>
                  <span className={styles.chevron}>
                    <Icon name="chevron" />
                  </span>
                </button>
              </h2>
              <div className={open[group.key] ? styles.body : styles.bodyClosed}>
                <p className={styles.help}>{group.help}</p>
                {inGroup.length > 0 ? (
                  <ul className={styles.items}>{inGroup.map(renderStatement ?? plainStatement)}</ul>
                ) : (
                  <Empty>{t.summary.empty}</Empty>
                )}
                {renderAdd && group.key !== 'confirmed' && <div className={styles.add}>{renderAdd(group.key)}</div>}
              </div>
            </section>
          )
        })}
      </div>
    </Page>
  )
}
