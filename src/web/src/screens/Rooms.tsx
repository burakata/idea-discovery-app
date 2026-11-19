import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Icon } from '../components/Icon'
import { Pill } from '../components/Pill'
import { projects } from '../projects'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Rooms.module.css'

export default function Rooms() {
  const { state } = useStore()
  const { pick } = useT()

  return (
    <Page>
      <PageTitle title={c.rooms.title} sub={c.rooms.sub} />
      <ul className={styles.rooms}>
        {projects.map((project) => {
          const room = state.rooms[project.id]
          const owners = project.participants.filter((participant) => participant.role === 'owner').length
          const isEmpty = room.messages.length === 0 && room.statements.length === 0
          return (
            <li key={project.id}>
              <Card className={styles.room}>
                <div className={styles.top}>
                  <span className={styles.icon}>
                    <Icon name={project.icon} size={24} />
                  </span>
                  <div className={styles.name}>
                    <h2>{pick(project.name).text}</h2>
                    <p>{pick(project.status).text}</p>
                  </div>
                </div>
                <p className={styles.lead}>{pick(project.intro.lead).text}</p>
                <div className={styles.facts}>
                  {isEmpty ? (
                    <Pill tone="neutral">{c.rooms.empty}</Pill>
                  ) : (
                    <>
                      <Pill tone="neutral">
                        {owners} {c.rooms.owners}
                      </Pill>
                      <Pill tone="neutral">
                        {room.messages.length} {c.rooms.messages}
                      </Pill>
                      <Pill tone={room.queue.length > 0 ? 'amber' : 'neutral'}>
                        {room.queue.length} {c.rooms.waiting}
                      </Pill>
                    </>
                  )}
                </div>
                <Button variant="primary" iconRight="arrowRight" to={`/rooms/${project.id}`}>
                  {c.rooms.open}
                </Button>
              </Card>
            </li>
          )
        })}
      </ul>
    </Page>
  )
}
