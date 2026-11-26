import { Link } from 'react-router-dom'
import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox } from '../components/Card'
import { Icon } from '../components/Icon'
import { roomPath } from '../state/roomRules'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Projects.module.css'

// The signed-in home: the projects this person belongs to, even if there is one.
// Every project opens its room. Burak's cards also lead to the project's People and its edit form.
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
        {projects?.map((project) => {
          const heading = (
            <div className={styles.top}>
              <span className={styles.icon}>
                <Icon name="idea" size={24} />
              </span>
              <div className={styles.name}>
                <h2>{pick(project.title).text}</h2>
              </div>
            </div>
          )
          const lead = project.lead && <p className={styles.lead}>{pick(project.lead).text}</p>

          // An owner's card is one link to the room. Burak's has three buttons, so it cannot be.
          if (!consultant) {
            return (
              <li key={project.id}>
                <Link className={styles.cardLink} to={roomPath(project.id)}>
                  <Card className={styles.project}>
                    {heading}
                    {lead}
                    <span className={styles.open}>
                      {t.projects.open}
                      <Icon name="arrowRight" size={18} />
                    </span>
                  </Card>
                </Link>
              </li>
            )
          }
          return (
            <li key={project.id}>
              <Card className={styles.project}>
                {heading}
                {lead}
                <Button variant="primary" iconRight="arrowRight" to={roomPath(project.id)}>
                  {t.projects.open}
                </Button>
                <div className={styles.actions}>
                  <Button variant="secondary" icon="people" to={roomPath(project.id, 'people')}>
                    {c.projects.people}
                  </Button>
                  <Button variant="quiet" icon="edit" to={roomPath(project.id, 'edit')}>
                    {c.projects.edit}
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
