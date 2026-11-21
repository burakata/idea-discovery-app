import { Button } from '../components/Button'
import { Card, NoticeBox } from '../components/Card'
import { Pill } from '../components/Pill'
import { PublicPage } from '../components/PublicPage'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { useDemoT } from '../strings/demo'
import { RequestLinkForm } from './RequestLinkForm'
import styles from './Public.module.css'

// Demo only: a visitor who has no email invitation can still look around.
function TryDemo() {
  const { demoSignIn } = useStore()
  const { sample } = useDemoT()
  return (
    <Card className={styles.card}>
      <div>
        <Pill tone="amber">{sample.tag}</Pill>
      </div>
      <h2>{sample.tryTitle}</h2>
      <p className={styles.lead}>{sample.tryExplain}</p>
      <div>
        <Button variant="primary" iconRight="arrowRight" onClick={demoSignIn}>
          {sample.tryButton}
        </Button>
      </div>
    </Card>
  )
}

// The first screen when nobody is signed in. It says what the app is for and
// shows nothing about any project or client.
export default function Home() {
  const { notice } = useStore()
  const { t } = useT()

  return (
    <PublicPage>
      {notice && <NoticeBox tone="amber">{t.notices[notice]}</NoticeBox>}
      {/* The demo's way in comes first: the email form does nothing there. */}
      {__DEMO__ && <TryDemo />}
      <Card className={styles.card}>
        <h1>{t.auth.home.title}</h1>
        <p className={styles.lead}>{t.auth.home.intro}</p>
        <RequestLinkForm />
        <p className={styles.small}>{t.auth.home.invitationNote}</p>
      </Card>
    </PublicPage>
  )
}
