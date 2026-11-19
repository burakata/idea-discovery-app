import type { ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Card.module.css'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={[styles.card, className].filter(Boolean).join(' ')}>{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>
}

interface NoticeProps {
  title?: string
  tone?: 'info' | 'amber'
  children: ReactNode
}

export function NoticeBox({ title, tone = 'info', children }: NoticeProps) {
  return (
    <div className={`${styles.notice} ${styles[tone]}`}>
      <Icon name="info" />
      <div>
        {title && <strong>{title}</strong>}
        <p>{children}</p>
      </div>
    </div>
  )
}

interface SectionTitleProps {
  title: string
  sub?: string
  aside?: ReactNode
}

export function SectionTitle({ title, sub, aside }: SectionTitleProps) {
  return (
    <div className={styles.sectionTitle}>
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {aside}
    </div>
  )
}
