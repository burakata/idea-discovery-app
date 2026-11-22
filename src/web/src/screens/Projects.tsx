import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox } from '../components/Card'
import { Icon } from '../components/Icon'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Projects.module.css'

// The signed-in home: the projects this person belongs to, even if there is one.
// A project opens only where its card has a link (the demo; the real rooms come
// in M1 PR 8). Burak's cards also lead to the project's People and its edit form.
export default function Projects() {
  const { me, projects, projectsError, notice } = useStore()
  const { t, pick } = useT()
  // Burak's list is in English, with his own wording.
  const consultant = me?.isConsultant === true

  return (
    <Page>
      <PageTitle
        title={consultant ? c.projects.title : t.projects.title}
        sub={consultant ? c.projects.sub : t.projects.sub}
        aside={
          consultant && (
            <Button variant="primary" icon="add" to="/projects/new">
              {c.projects.create}
            </Button>
          )
        }
      />
      {notice && (
        <div className={styles.notice}>
          <NoticeBox tone="amber">{t.notices[notice]}</NoticeBox>
        </div>
      )}
      {projectsError && <NoticeBox tone="amber">{t.errors[projectsError]}</NoticeBox>}
      {projects?.length === 0 && <Empty>{consultant ? c.projects.empty : t.projects.empty}</Empty>}
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
              {consultant && (
                <div className={styles.actions}>
                  <Button
                    variant={project.to ? 'secondary' : 'primary'}
                    icon="people"
                    to={`/projects/${encodeURIComponent(project.id)}/people`}
                  >
                    {c.projects.people}
                  </Button>
                  <Button variant="quiet" icon="edit" to={`/projects/${encodeURIComponent(project.id)}/edit`}>
                    {c.projects.edit}
                  </Button>
                </div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  )
}
