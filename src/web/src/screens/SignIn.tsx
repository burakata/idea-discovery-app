import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { Button } from '../components/Button'
import { Card, NoticeBox } from '../components/Card'
import { PublicPage } from '../components/PublicPage'
import type { Lang } from '../languages'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { useDemoT } from '../strings/demo'
import { RequestLinkForm } from './RequestLinkForm'
import { forgetSignInToken, takeSignInToken } from './signInLink'
import styles from './Public.module.css'

// Demo only: the real page opens from an emailed link; the demo has none.
function SampleNote() {
  const { sample } = useDemoT()
  return (
    <NoticeBox tone="amber" title={sample.linkTitle}>
      {sample.linkExplain}
    </NoticeBox>
  )
}

// Where the emailed link lands. Opening the link changes nothing: the token is
// used only when the person presses "Sign in".
export default function SignIn() {
  const { redeem } = useStore()
  const { t } = useT()
  const navigate = useNavigate()
  // Taken out of the address at once; see signInLink.ts.
  const [token] = useState(() => takeSignInToken())
  const [chosen, setChosen] = useState<Lang | null>(null)
  const [phase, setPhase] = useState<'ready' | 'working' | 'invalid'>(!__DEMO__ && !token ? 'invalid' : 'ready')
  const [error, setError] = useState<string | null>(null)

  const signIn = async () => {
    setPhase('working')
    setError(null)
    try {
      await redeem(token, chosen)
      forgetSignInToken()
      navigate('/', { replace: true })
    } catch (failure) {
      const api = failure instanceof ApiError ? failure : new ApiError(0, null)
      if (api.code === 'link_not_valid') {
        // The link was used, has expired or never existed.
        forgetSignInToken()
        setPhase('invalid')
      } else {
        // The server did not judge the link (no connection, too many tries): try again.
        setError(t.errors[api.key])
        setPhase('ready')
      }
    }
  }

  return (
    <PublicPage onLanguageChange={setChosen}>
      {phase === 'invalid' ? (
        <Card className={styles.card}>
          <h1>{t.auth.signIn.invalidTitle}</h1>
          <p className={styles.lead}>{t.errors.linkNotValid}</p>
          <RequestLinkForm />
        </Card>
      ) : (
        <Card className={styles.card}>
          {__DEMO__ && <SampleNote />}
          <h1>{t.auth.signIn.title}</h1>
          <p className={styles.lead}>{t.auth.signIn.explain}</p>
          {error && <p className={styles.error}>{error}</p>}
          <div>
            <Button variant="primary" iconRight="arrowRight" disabled={phase === 'working'} onClick={signIn}>
              {t.auth.signIn.button}
            </Button>
          </div>
        </Card>
      )}
    </PublicPage>
  )
}
