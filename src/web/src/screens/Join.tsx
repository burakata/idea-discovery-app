import { useState, type FormEvent } from 'react'
import { Navigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { Page } from '../components/AppShell'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { TextInput } from '../components/Field'
import { Icon } from '../components/Icon'
import type { Project } from '../projects/types'
import { useStore } from '../state/store'
import { useT } from '../strings'
import styles from './Join.module.css'

export default function Join() {
  const project = useOutletContext<Project>()
  const { viewer, dispatch } = useStore()
  const { t, pick } = useT()
  const [params] = useSearchParams()
  const [name, setName] = useState('')
  const [showError, setShowError] = useState(false)

  // Once joined, carry on to where the person was heading.
  const next = params.get('next') === 'summary' ? 'summary' : 'discussion'
  if (viewer.joined) return <Navigate to={`/rooms/${project.id}/${next}`} replace />

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setShowError(true)
      return
    }
    dispatch({ type: 'join', name: trimmed })
  }

  return (
    <Page narrow>
      <Card className={styles.card}>
        <span className={styles.icon}>
          <Icon name="people" size={26} />
        </span>
        <p className={styles.project}>{pick(project.name).text}</p>
        <h1>{t.join.title}</h1>
        <p className={styles.intro}>{t.join.intro}</p>
        <form onSubmit={submit} noValidate>
          <label htmlFor="display-name">{t.join.nameLabel}</label>
          <TextInput
            id="display-name"
            autoComplete="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setShowError(false)
            }}
            aria-describedby="display-name-hint"
          />
          <p
            id="display-name-hint"
            className={showError ? styles.error : styles.hint}
            role={showError ? 'alert' : undefined}
          >
            {showError ? t.join.nameMissing : t.join.nameHint}
          </p>
          <Button variant="primary" type="submit" wide iconRight="arrowRight">
            {t.join.submit}
          </Button>
        </form>
      </Card>
    </Page>
  )
}
