import { Icon } from './Icon'
import styles from './Avatar.module.css'

export type AvatarTone = 'owner' | 'consultant' | 'assistant' | 'mine'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toLocaleUpperCase())
    .join('')
}

export function Avatar({ name, tone }: { name: string; tone: AvatarTone }) {
  return (
    <span className={`${styles.avatar} ${styles[tone]}`} aria-hidden="true">
      {tone === 'assistant' ? <Icon name="assistant" size={18} /> : initials(name)}
    </span>
  )
}

interface RowProps {
  name: string
  role: string
  tone: AvatarTone
}

export function ParticipantRow({ name, role, tone }: RowProps) {
  return (
    <li className={styles.row}>
      <Avatar name={name} tone={tone} />
      <div className={styles.who}>
        <strong>{name}</strong>
        <span>{role}</span>
      </div>
    </li>
  )
}
