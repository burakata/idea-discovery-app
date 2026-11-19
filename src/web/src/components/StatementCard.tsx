import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './StatementCard.module.css'

export interface ReactionView {
  key: string
  name: string
  kind: 'right' | 'notRight'
  label: string
  correction?: ReactNode
}

interface Props {
  text: string
  // Shown beneath the text, for example the translation placeholder.
  note?: ReactNode
  // Shown when nobody has reacted yet.
  status?: string
  reactions?: ReactionView[]
  children?: ReactNode
}

export function StatementCard({ text, note, status, reactions = [], children }: Props) {
  return (
    <li className={styles.card}>
      <p className={styles.text}>{text}</p>
      {note}
      {reactions.length === 0 && status && <p className={styles.status}>{status}</p>}
      {reactions.length > 0 && (
        <ul className={styles.reactions}>
          {reactions.map((reaction) => (
            <li
              key={reaction.key}
              className={`${styles[reaction.kind]} ${reaction.correction ? styles.withCorrection : ''}`}
            >
              <span className={styles.reaction}>
                <Icon name={reaction.kind === 'right' ? 'check' : 'close'} size={16} />
                <strong>{reaction.name}</strong>
                {reaction.label}
              </span>
              {reaction.correction && <div className={styles.correction}>{reaction.correction}</div>}
            </li>
          ))}
        </ul>
      )}
      {children && <div className={styles.actions}>{children}</div>}
    </li>
  )
}
