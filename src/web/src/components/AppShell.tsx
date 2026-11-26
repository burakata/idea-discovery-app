import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Room } from '../state/context'
import { hasDiscussion, roomPath, shownConversation } from '../state/roomRules'
import { useStore } from '../state/store'
import { fill, useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { useDemoT } from '../strings/demo'
import { Button } from './Button'
import { NoticeBox } from './Card'
import { Icon, type IconName } from './Icon'
import { LanguageSwitch } from './LanguageSwitch'
import { CountBadge, Pill } from './Pill'
import styles from './AppShell.module.css'

interface NavItem {
  to: string
  icon: IconName
  label: string
  // Used in the link strip on phones, where space is short.
  short?: string
  end?: boolean
  count?: number
  countLabel?: string
}

function NavList({ items, className, compact }: { items: NavItem[]; className: string; compact?: boolean }) {
  return (
    <nav className={className}>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => (isActive ? styles.active : undefined)}
        >
          <Icon name={item.icon} />
          <span>{compact ? (item.short ?? item.label) : item.label}</span>
          {item.count !== undefined && <CountBadge count={item.count} label={item.countLabel ?? ''} />}
        </NavLink>
      ))}
    </nav>
  )
}

function DemoNote() {
  const { preview } = useDemoT()
  return (
    <div className={styles.sideNote}>
      <strong>{preview.label}</strong>
      <p>{preview.explain}</p>
    </div>
  )
}

interface ShellProps {
  // Without a room, the shell shows the person's project list.
  room?: Room
  // Burak's waiting count for the room; demo only.
  queueCount?: number
  children: ReactNode
}

// Navy sidebar on desktop; compact header and bottom navigation on phones.
export function AppShell({ room, queueCount = 0, children }: ShellProps) {
  const { me, setLanguage, signOut, actionError } = useStore()
  const { t, lang, englishOnly, pick } = useT()
  const { pathname } = useLocation()
  const isConsultant = me?.isConsultant === true
  const base = room ? roomPath(room.id) : ''

  const sections: NavItem[] = room
    ? [
        { to: base, icon: 'idea', label: t.nav.idea, end: true },
        ...(hasDiscussion(room)
          ? [{ to: `${base}/discussion`, icon: 'discussion' as const, label: t.nav.discussion }]
          : []),
        { to: `${base}/summary`, icon: 'summary', label: t.nav.summary },
      ]
    : [{ to: '/', icon: 'rooms', label: t.nav.projects, end: true }]

  // Burak's own items. People and the project list follow his language setting; the queue and
  // private notes (English only) are the demo's until the API has them.
  const consultantItems: NavItem[] = room
    ? [
        { to: `${base}/people`, icon: 'people', label: t.nav.people, short: t.nav.people },
        ...(__DEMO__ && hasDiscussion(room)
          ? [
              {
                to: `${base}/queue`,
                icon: 'queue' as const,
                label: c.nav.queue,
                short: c.nav.queueShort,
                count: queueCount,
                countLabel: c.nav.waiting,
              },
              { to: `${base}/notes`, icon: 'notes' as const, label: c.nav.notes, short: c.nav.notesShort },
            ]
          : []),
        // Back to the list; on the list itself the sections already hold it.
        { to: '/', icon: 'rooms', label: t.nav.projects, short: t.nav.projects, end: true },
      ]
    : []

  const title = room ? pick(room.title).text : isConsultant ? c.projects.title : t.projects.title
  const conversation = room ? shownConversation(room.conversations) : undefined
  const conversationLine = conversation
    ? [
        fill(t.room.conversation, { number: String(conversation.number) }),
        ...(conversation.state === 'finished' ? [t.room.finished] : []),
      ].join(' · ')
    : null
  // The draft pill belongs to the room's three sections, not to Join or Burak's screens.
  const signedInAs = me ? fill(t.auth.signedInAs, { name: me.displayName }) : null
  const onSection = sections.some((section) => section.to === pathname)

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <Icon name="brand" size={22} />
          </span>
          <div>
            <strong>{t.app.name}</strong>
            <small>{t.app.tagline}</small>
          </div>
        </div>

        {room && (
          <div>
            <div className={styles.label}>{t.nav.project}</div>
            <div className={styles.project}>
              <span className={styles.projectIcon}>
                <Icon name="idea" />
              </span>
              <div>
                <strong>{title}</strong>
                {conversationLine && <small>{conversationLine}</small>}
              </div>
            </div>
            <NavList items={sections} className={styles.nav} />
          </div>
        )}

        {!room && <NavList items={sections} className={styles.nav} />}

        {isConsultant && consultantItems.length > 0 && (
          <div>
            <div className={styles.label}>{t.nav.forYou}</div>
            <NavList items={consultantItems} className={styles.nav} />
          </div>
        )}

        {__DEMO__ && <DemoNote />}
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.crumb}>
            <span className={styles.crumbPath}>{t.app.name} / </span>
            {/* On phones the rooms list shows the app's name here, as its own title follows. */}
            {!room && <span className={`${styles.crumbName} ${styles.phoneOnly}`}>{t.app.name}</span>}
            <span className={room ? styles.crumbName : `${styles.crumbName} ${styles.desktopOnly}`}>
              {title}
            </span>
            {/* On desktop the sidebar already says it. */}
            {conversationLine && <small className={`${styles.crumbSub} ${styles.phoneOnly}`}>{conversationLine}</small>}
          </div>
          <div className={styles.topRight}>
            {signedInAs && <span className={styles.who}>{signedInAs}</span>}
            {onSection && room && room.content.statements.length > 0 && (
              <span className={styles.status}>
                <Pill tone="amber">{t.status.draft}</Pill>
              </span>
            )}
            {!englishOnly && (
              <LanguageSwitch
                value={lang}
                onChange={setLanguage}
                label={t.language.label}
              />
            )}
            <Button
              variant="quiet"
              size="sm"
              icon="signOut"
              className={styles.signOut}
              aria-label={t.auth.signOut}
              onClick={() => void signOut()}
            >
              {t.auth.signOut}
            </Button>
          </div>
        </header>

        {signedInAs && <p className={styles.whoPhone}>{signedInAs}</p>}
        {isConsultant && room && <NavList items={consultantItems} className={styles.strip} compact />}

        {actionError && (
          <div className={styles.alert}>
            <NoticeBox tone="amber">{t.errors[actionError]}</NoticeBox>
          </div>
        )}

        <div className={styles.content}>{children}</div>

        {room && <NavList items={sections} className={styles.bottomNav} />}
      </div>
    </div>
  )
}

// A scrolling page with the standard padding and width.
export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return (
    <main className={styles.page}>
      <div className={narrow ? styles.narrow : styles.inner}>{children}</div>
    </main>
  )
}

interface PageTitleProps {
  title: string
  sub?: string
  // Shown beside the title, for example how many items are waiting.
  count?: { value: number; label: string }
  aside?: ReactNode
}

export function PageTitle({ title, sub, count, aside }: PageTitleProps) {
  return (
    <div className={styles.pageTitle}>
      <div>
        <h1>
          {title}
          {count && <CountBadge count={count.value} label={count.label} />}
        </h1>
        {sub && <p>{sub}</p>}
      </div>
      {aside}
    </div>
  )
}
