import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { ApiError, type ConsultantErrorKey } from '../api/client'
import { Page, PageTitle } from '../components/AppShell'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/Card'
import { TextArea, TextInput } from '../components/Field'
import type { ProjectDraft } from '../state/context'
import { useStore } from '../state/store'
import { fill } from '../strings'
import { consultant as c } from '../strings/consultant'
import { cleanDraft, emptyDraft, formGroups, PROJECT_LIMITS, validateDraft } from './projectFormRules'
import styles from './ProjectForm.module.css'

// Create a project, or edit one: the same form, prefilled when editing.
export default function ProjectForm() {
  const { projectId } = useParams()
  const { createProject, saveProject, getProject } = useStore()
  const navigate = useNavigate()
  const t = c.projectForm
  const [draft, setDraft] = useState<ProjectDraft | null>(projectId ? null : emptyDraft())
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<ConsultantErrorKey | null>(null)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let current = true
    getProject(projectId).then(
      (project) => current && setDraft({ title: project.title, intro: project.intro }),
      (error: unknown) => {
        if (!current) return
        // A project that is gone sends Burak back to his list.
        if (error instanceof ApiError && error.status === 404) setGone(true)
        else setFailure(error instanceof ApiError ? error.consultantKey : 'generic')
      },
    )
    return () => {
      current = false
    }
    // Loaded once per project: the store's functions change identity as the demo state changes.
  }, [projectId])

  if (gone) return <Navigate to="/" replace />

  const errors = draft ? validateDraft(draft) : {}
  const editing = projectId !== undefined

  const change = (kind: 'title' | 'intro', lang: keyof ProjectDraft['title'], value: string) => {
    if (!draft) return
    setDraft({ ...draft, [kind]: { ...draft[kind], [lang]: value } })
    setFailure(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!draft || busy) return
    setShown(true)
    if (Object.keys(errors).length > 0) return
    setBusy(true)
    setFailure(null)
    try {
      const clean = cleanDraft(draft)
      if (projectId) await saveProject(projectId, clean)
      else await createProject(clean)
      navigate('/')
    } catch (error) {
      setFailure(error instanceof ApiError ? error.consultantKey : 'generic')
      setBusy(false)
    }
  }

  const limits = { title: String(PROJECT_LIMITS.title), intro: String(PROJECT_LIMITS.intro) }
  const message = (key: string | undefined) =>
    key === undefined
      ? null
      : fill(t[key as keyof typeof t], { max: key.startsWith('title') ? limits.title : limits.intro })

  return (
    <Page narrow>
      <PageTitle
        title={editing ? t.editTitle : t.createTitle}
        sub={editing ? t.editSub : t.createSub}
      />
      {failure && !draft && <NoticeBox tone="amber">{c.errors[failure]}</NoticeBox>}
      {!draft && !failure && <p role="status">{t.loading}</p>}
      {draft && (
        <form className={styles.form} onSubmit={submit} noValidate>
          {formGroups().map(({ lang, label }) => {
            const titleError = shown ? message(errors[`title.${lang}`]) : null
            const introError = shown ? message(errors[`intro.${lang}`]) : null
            return (
              <fieldset key={lang} className={styles.group}>
                <legend>{label}</legend>
                <label htmlFor={`title-${lang}`}>{t.titleLabel}</label>
                <TextInput
                  id={`title-${lang}`}
                  value={draft.title[lang]}
                  onChange={(event) => change('title', lang, event.target.value)}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={`title-${lang}-note`}
                />
                <p id={`title-${lang}-note`} className={titleError ? styles.error : styles.hint}>
                  {titleError ?? fill(t.titleHint, { max: limits.title })}
                </p>
                <label htmlFor={`intro-${lang}`}>{t.introLabel}</label>
                <TextArea
                  id={`intro-${lang}`}
                  rows={6}
                  value={draft.intro[lang]}
                  onChange={(event) => change('intro', lang, event.target.value)}
                  aria-invalid={introError ? true : undefined}
                  aria-describedby={`intro-${lang}-note`}
                />
                <p id={`intro-${lang}-note`} className={introError ? styles.error : styles.hint}>
                  {introError ?? fill(t.introHint, { max: limits.intro })}
                </p>
              </fieldset>
            )
          })}
          {failure && (
            <div role="alert">
              <NoticeBox tone="amber">{c.errors[failure]}</NoticeBox>
            </div>
          )}
          <div className={styles.actions}>
            <Button variant="primary" type="submit" disabled={busy}>
              {busy ? t.saving : editing ? t.save : t.create}
            </Button>
            <Button variant="quiet" to="/">
              {t.cancel}
            </Button>
          </div>
        </form>
      )}
    </Page>
  )
}
