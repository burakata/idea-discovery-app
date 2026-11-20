import { useOutletContext } from 'react-router-dom'
import { Page, PageTitle } from '../components/AppShell'
import { Card, Empty, NoticeBox } from '../components/Card'
import { Pill } from '../components/Pill'
import { sampleNotes } from '../demo/seed'
import type { Project } from '../projects/types'
import { useT } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './Notes.module.css'

export default function Notes() {
  const project = useOutletContext<Project>()
  const { time } = useT()
  const note = sampleNotes[project.id]

  return (
    <Page narrow>
      <PageTitle title={c.notes.title} sub={c.notes.sub} />
      {note ? (
        <>
          <Card>
            <div className={styles.head}>
              <Pill tone="amber">{c.notes.sample}</Pill>
              <span>
                {c.notes.written} {time(note.written)}
              </span>
            </div>
            <ol className={styles.sections}>
              {note.sections.map((section) => (
                <li key={section.heading}>
                  <h2>{section.heading}</h2>
                  {section.caveat && <p className={styles.caveat}>{section.caveat}</p>}
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>
          <div className={styles.notice}>
            <NoticeBox tone="amber">{c.notes.simulated}</NoticeBox>
          </div>
        </>
      ) : (
        <Empty>{c.notes.empty}</Empty>
      )}
    </Page>
  )
}
