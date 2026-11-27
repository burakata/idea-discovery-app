import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card, Empty, NoticeBox, SectionTitle } from '../components/Card'
import { HeroArt } from '../components/HeroArt'
import { Icon } from '../components/Icon'
import { JobFlow } from '../components/JobFlow'
import { Pill } from '../components/Pill'
import type { Room } from '../state/context'
import { hasDiscussion, roomPath, showsHeroImage } from '../state/roomRules'
import { useStore } from '../state/store'
import { useT } from '../strings'
import styles from './Idea.module.css'

// The idea page, the same for every project and both builds: the project's own title,
// introduction and content, and the app's own text around them.
export default function Idea() {
  const room = useOutletContext<Room>()
  const { t, pick } = useT()
  const { projectImageUrl } = useStore()
  // The version that failed to load: that image is replaced by the illustration.
  const [failedVersion, setFailedVersion] = useState<string | null>(null)

  const { content } = room
  const heroVersion = showsHeroImage(room.imageVersion, failedVersion) ? room.imageVersion : null
  const needsConfirmation = <Pill tone="amber">{t.status.needsConfirmation}</Pill>

  const steps = content.jobFlow.map((step) => {
    return {
      id: step.id,
      icon: step.icon,
      who: pick(step.who).text,
      what: pick(step.what).text,
      unknown: step.unknown,
    }
  })

  return (
    <Page>
      <section className={styles.hero}>
        <div>
          <h1>{pick(room.title).text}</h1>
          <p className={styles.lead}>{pick(room.intro).text}</p>
          {hasDiscussion(room) && (
            <div className={styles.actions}>
              <Button variant="primary" iconRight="arrowRight" to={roomPath(room.id, 'discussion')}>
                {t.idea.join}
              </Button>
            </div>
          )}
        </div>
        <div className={`${styles.art} ${heroVersion ? styles.artPhoto : ''}`}>
          {heroVersion ? (
            <img
              className={styles.photo}
              src={projectImageUrl(room.id, heroVersion)}
              alt=""
              onError={() => setFailedVersion(heroVersion)}
            />
          ) : (
            <HeroArt />
          )}
        </div>
      </section>

      <div className={styles.two}>
        <Card>
          <h2 className={styles.cardTitle}>{t.idea.purposeTitle}</h2>
          <ul className={styles.list}>
            {t.idea.purposePoints.map((item, index) => (
              <li key={index} className={styles.bullet}>
                {item}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className={styles.cardTitle}>{t.idea.notYetTitle}</h2>
          <ul className={styles.list}>
            {t.idea.notYetPoints.map((item, index) => (
              <li key={index} className={styles.no}>
                <Icon name="close" size={18} />
                {item}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <SectionTitle
        title={t.idea.flowTitle}
        sub={steps.length > 0 ? t.idea.flowSub : undefined}
        aside={steps.length > 0 && needsConfirmation} />
      {steps.length > 0 ? (
        <JobFlow steps={steps} unknownLabel={t.idea.unknownStep} />
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}

      <SectionTitle
        title={t.idea.understandingTitle}
        sub={content.understanding.length > 0 ? t.idea.understandingSub : undefined}
        aside={content.understanding.length > 0 && needsConfirmation}
      />
      {content.understanding.length > 0 ? (
        <>
          <Card>
            <h3 className={styles.cardTitle}>{t.idea.interpretationsTitle}</h3>
            <ul className={styles.list}>
              {content.understanding.map((item, index) => (
                <li key={index} className={styles.point}>
                  <Icon name="early" size={18} />
                  {pick(item).text}
                </li>
              ))}
            </ul>
          </Card>
          <div className={styles.note}>
            <NoticeBox title={t.idea.noteTitle}>{t.idea.note}</NoticeBox>
            <Button variant="quiet" iconRight="arrowRight" to={roomPath(room.id, 'summary')}>
              {t.idea.seeSummary}
            </Button>
          </div>
        </>
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}

      <SectionTitle
        title={t.idea.unclearTitle}
        sub={content.openQuestions.length > 0 ? t.idea.unclearSub : undefined}
      />
      {content.openQuestions.length > 0 ? (
        <Card>
          <ul className={styles.list}>
            {content.openQuestions.map((item, index) => (
              <li key={index} className={styles.point}>
                <Icon name="question" size={18} />
                {pick(item).text}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}

      <SectionTitle
        title={t.idea.similarTitle}
        sub={content.similarBusinesses.length > 0 ? t.idea.similarSub : undefined}
        aside={content.similarBusinesses.length > 0 && <Pill>{t.status.examplesOnly}</Pill>}
      />
      {content.similarBusinesses.length > 0 ? (
        <>
          <div className={styles.similar}>
            {content.similarBusinesses.map((business, index) => (
              <Card key={index} className={styles.business}>
                <p className={styles.how}>{pick(business.how).text}</p>
                <div className={styles.brandRow}>
                  <Pill tone="neutral">{pick(business.name).text}</Pill>
                  {business.url && (
                    <a href={business.url} target="_blank" rel="noopener noreferrer">
                      {t.idea.visit}
                      <Icon name="external" size={16} />
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
          <p className={styles.question}>{t.idea.similarQuestion}</p>
        </>
      ) : (
        <Empty>{t.idea.empty}</Empty>
      )}
    </Page>
  )
}
