import { useState } from 'react'
import type { ConsultantErrorKey } from '../api/client'
import { Button } from '../components/Button'
import { NoticeBox } from '../components/Card'
import { Dialog } from '../components/Dialog'
import { TextInput } from '../components/Field'
import { fill } from '../strings'
import { consultant as c } from '../strings/consultant'
import styles from './People.module.css'

const p = c.people
const ask = p.asking

// Approving: Burak may correct the name first; nothing else changes.
export function ApproveDialog({
  name,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  name: string
  busy: boolean
  error: ConsultantErrorKey | null
  onConfirm: (displayName: string) => void
  onClose: () => void
}) {
  const [text, setText] = useState(name)
  return (
    <Dialog title={fill(ask.approveTitle, { name })} onClose={onClose} closeLabel={p.close}>
      <form
        className={styles.dialogBody}
        onSubmit={(event) => {
          event.preventDefault()
          if (!busy && text.trim() !== '') onConfirm(text.trim())
        }}
      >
        <p>{ask.approveBody}</p>
        <label htmlFor="approve-name">{ask.approveNameLabel}</label>
        <TextInput
          id="approve-name"
          maxLength={80}
          autoComplete="off"
          value={text}
          data-autofocus
          onChange={(event) => setText(event.target.value)}
        />
        {error && (
          <div role="alert">
            <NoticeBox tone="amber">{c.errors[error]}</NoticeBox>
          </div>
        )}
        <div className={styles.dialogActions}>
          <Button variant="secondary" onClick={onClose}>
            {p.cancel}
          </Button>
          <Button variant="primary" type="submit" disabled={busy || text.trim() === ''}>
            {ask.approveConfirm}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
