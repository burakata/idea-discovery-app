import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox, SectionTitle } from '../components/Card'
import { HeroArt } from '../components/HeroArt'
import { Icon } from '../components/Icon'
import { JobFlow } from '../components/JobFlow'
import { TranslationLine } from '../components/MessageBubble'
import { Pill } from '../components/Pill'
import type { Project } from '../projects/types'
import { useStore } from '../state/store'
import { useT } from '../strings'
import styles from './Idea.module.css'

export default function Idea() {
  const project = useOutletContext<Project>()
  const { state } = useStore()
  const { t, lang, pick } = useT()
  const [printNote, setPrintNote] = useState(false)

  const base = `/rooms/${project.id}`
  const { intro } = project
  const printUrl = project.printVersion[lang]
  const hasPrintVersion = Object.keys(project.printVersion).length > 0
  const needsConfirmation = <Pill tone="amber">{t.status.needsConfirmation}</Pill>

  const steps = state.rooms[project.id].jobFlow.map((step) => {
    const who = pick(step.who)
    const what = pick(step.what)
    return {
      id: step.id,
      icon: step.icon,
      who: who.text,
      what: what.text,
      unknown: step.unknown,
      note:
        who.missing || what.missing ? (
          <TranslationLine label={t.discussion.translated} placeholder={t.discussion.translationPlaceholder} />
        ) : undefined,
    }
  })

  return (
    <Page>
      <section className={project.illustration ? styles.hero : `${styles.hero} ${styles.plain}`}>
        <div>
          <p className={styles.eyebrow}>{pick(intro.eyebrow).text}</p>
          <h1>{pick(intro.title).text}</h1>
          <p className={styles.lead}>{pick(intro.lead).text}</p>
          <div className={styles.actions}>
            <Button variant="primary" iconRight="arrowRight" to={`${base}/discussion`}>
              {t.idea.join}
            </Button>
            {printUrl && (
              <Button icon="print" href={printUrl}>
                {t.idea.print}
              </Button>
            )}
            {!printUrl && hasPrintVersion && (
              <Button icon="print" onClick={() => setPrintNote(true)}>
                {t.idea.print}
              </Button>
            )}
          </div>
          {printNote && !printUrl && (
            <p className={styles.printNote} role="status">
              {t.idea.printComing}
            </p>
          )}
        </div>
        {project.illustration === 'warehouse' && (
          <div className={styles.art}>
            <HeroArt />
          </div>
        )}
      </section>

      {intro.purpose.length > 0 && (
        <div className={styles.two}>
          <Card>
            <h2 className={styles.cardTitle}>{t.idea.purposeTitle}</h2>
            <ul className={styles.list}>
              {intro.purpose.map((item) => (
                <li key={item.en} className={styles.yes}>
                  <Icon name="check" size={18} />
                  {pick(item).text}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className={styles.cardTitle}>{t.idea.notYetTitle}</h2>
            <ul className={styles.list}>
              {intro.notYet.map((item) => (
                <li key={item.en} className={styles.no}>
                  <Icon name="close" size={18} />
                  {pick(item).text}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      <SectionTitle title={t.idea.flowTitle} sub={t.idea.flowSub} aside={steps.length > 0 && needsConfirmation} />
      {steps.length > 0 ? (
        <JobFlow steps={steps} unknownLabel={t.idea.unknownStep} />
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}

      <SectionTitle
        title={t.idea.understandingTitle}
        sub={t.idea.understandingSub}
        aside={project.understanding.length > 0 && needsConfirmation}
      />
      {project.understanding.length > 0 ? (
        <>
          <div className={styles.two}>
            <Card>
              <h3 className={styles.cardTitle}>{t.idea.interpretationsTitle}</h3>
              <ul className={styles.list}>
                {project.understanding.map((item) => (
                  <li key={item.en} className={styles.point}>
                    <Icon name="early" size={18} />
                    {pick(item).text}
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h3 className={styles.cardTitle}>{t.idea.unclearTitle}</h3>
              <ul className={styles.list}>
                {project.unclear.map((item) => (
                  <li key={item.en} className={styles.point}>
                    <Icon name="question" size={18} />
                    {pick(item).text}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className={styles.note}>
            <NoticeBox title={t.idea.noteTitle}>{t.idea.note}</NoticeBox>
            <Button variant="quiet" iconRight="arrowRight" to={`${base}/summary`}>
              {t.idea.seeSummary}
            </Button>
          </div>
        </>
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}

      <SectionTitle
        title={t.idea.similarTitle}
        sub={t.idea.similarSub}
        aside={project.similarBusinesses.length > 0 && <Pill>{t.status.examplesOnly}</Pill>}
      />
      {project.similarBusinesses.length > 0 ? (
        <>
          <div className={styles.similar}>
            {project.similarBusinesses.map((business) => (
              <Card key={business.name} className={styles.business}>
                <p className={styles.how}>{pick(business.how).text}</p>
                <div className={styles.brandRow}>
                  <Pill tone="neutral">{business.name}</Pill>
                  <a href={business.url} target="_blank" rel="noopener noreferrer">
                    {t.idea.visit}
                    <Icon name="external" size={16} />
                  </a>
                </div>
              </Card>
            ))}
          </div>
          <p className={styles.question}>{pick(project.similarQuestion).text}</p>
        </>
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}
    </Page>
  )
}
