import type { ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { Project } from '../projects/types'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import { useDemoT } from '../strings/demo'
import { Button } from './Button'
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
  // A room (demo only until M1 PR 8). Without one, the shell shows the person's project list.
  project?: Project
  // Burak's waiting count for the room; demo only.
  queueCount?: number
  // The title when there is no room; the project list by default.
  title?: string
  children: ReactNode
}

// Navy sidebar on desktop; compact header and bottom navigation on phones.
export function AppShell({ project, queueCount = 0, title: pageTitle, children }: ShellProps) {
  const { me, setLanguage, signOut } = useStore()
  const { t, lang, englishOnly, pick } = useT()
  const { pathname } = useLocation()
  const isConsultant = me?.isConsultant === true
  const base = project ? `/rooms/${project.id}` : ''

  const sections: NavItem[] = project
    ? [
        { to: base, icon: 'idea', label: t.nav.idea, end: true },
        { to: `${base}/discussion`, icon: 'discussion', label: t.nav.discussion },
        { to: `${base}/summary`, icon: 'summary', label: t.nav.summary },
      ]
    : [{ to: '/', icon: 'rooms', label: t.nav.projects, end: true }]

  // Burak's own screens are the demo's until M1 PR 7b.
  const consultantItems: NavItem[] = !__DEMO__ ? [] : [
    ...(project
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
    { to: '/rooms', icon: 'rooms', label: c.nav.rooms, short: c.nav.roomsShort, end: true },
  ]

  const title = project ? pick(project.name).text : (pageTitle ?? t.projects.title)
  // The draft pill belongs to the room's three sections, not to Join or Burak's screens.
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

        {project && (
          <div>
            <div className={styles.label}>{t.nav.project}</div>
            <div className={styles.project}>
              <span className={styles.projectIcon}>
                <Icon name={project.icon} />
              </span>
              <div>
                <strong>{title}</strong>
                <small>{pick(project.status).text}</small>
              </div>
            </div>
            <NavList items={sections} className={styles.nav} />
          </div>
        )}

        {isConsultant && __DEMO__ && (
          <div>
            <div className={styles.label}>{c.nav.group}</div>
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
            {!project && <span className={`${styles.crumbName} ${styles.phoneOnly}`}>{t.app.name}</span>}
            <span className={project ? styles.crumbName : `${styles.crumbName} ${styles.desktopOnly}`}>
              {title}
            </span>
          </div>
          <div className={styles.topRight}>
            {onSection && project && project.statements.length > 0 && (
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

        {isConsultant && __DEMO__ && project && <NavList items={consultantItems} className={styles.strip} compact />}

        <div className={styles.content}>{children}</div>

        {project && <NavList items={sections} className={styles.bottomNav} />}
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
