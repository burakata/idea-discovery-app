import type { ReactNode } from 'react'
import styles from './Pill.module.css'

interface Props {
  tone?: 'amber' | 'info' | 'green' | 'neutral'
  children: ReactNode
}

export function Pill({ tone = 'info', children }: Props) {
  return <span className={`${styles.pill} ${styles[tone]}`}>{children}</span>
}

export function CountBadge({ count, label }: { count: number; label: string }) {
  if (count === 0) return null
  return (
    <span className={styles.badge} aria-label={`${count} ${label}`}>
      {count}
    </span>
  )
}
