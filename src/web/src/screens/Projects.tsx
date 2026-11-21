import { useEffect } from 'react'
import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox } from '../components/Card'
import { Icon } from '../components/Icon'
import { useStore } from '../state/store'
import { useT } from '../strings'
import styles from './Projects.module.css'

// The signed-in home: the projects this person belongs to, even if there is one.
// A project opens only where its card has a link (the demo; the real rooms come
// in M1 PR 8), so the real cards are plain.
export default function Projects() {
  const { projects, notice, clearNotice } = useStore()
  const { t, pick } = useT()

  // A message that sent the person here is shown once.
  useEffect(() => clearNotice, [clearNotice])

  return (
    <Page>
      <PageTitle title={t.projects.title} sub={t.projects.sub} />
      {notice && (
        <div className={styles.notice}>
          <NoticeBox tone="amber">{t.notices[notice]}</NoticeBox>
        </div>
      )}
      {projects?.length === 0 && <Empty>{t.projects.empty}</Empty>}
      <ul className={styles.list}>
        {projects?.map((project) => (
          <li key={project.id}>
            <Card className={styles.project}>
              <div className={styles.top}>
                <span className={styles.icon}>
                  <Icon name="idea" size={24} />
                </span>
                <div className={styles.name}>
                  <h2>{pick(project.title).text}</h2>
                </div>
              </div>
              {project.lead && <p className={styles.lead}>{pick(project.lead).text}</p>}
              {project.to && (
                <Button variant="primary" iconRight="arrowRight" to={project.to}>
                  {t.projects.open}
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  )
}
