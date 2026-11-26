import { Avatar, type AvatarTone } from './Avatar'
import { Icon } from './Icon'
import styles from './MessageBubble.module.css'

interface TranslationProps {
  label: string
  text: string
}

export function TranslationLine({ label, text }: TranslationProps) {
  return (
    <p className={styles.translation}>
      <span className={styles.translationLabel}>
        <Icon name="translate" size={14} />
        {label}
      </span>
      {text}
    </p>
  )
}

interface Props {
  name: string
  // Left out for the assistant, whose name already says what it is.
  role?: string
  time: string
  text: string
  tone: AvatarTone
  mine?: boolean
  tag?: string
  translation?: TranslationProps
}

export function MessageBubble({ name, role, time, text, tone, mine, tag, translation }: Props) {
  const classes = [styles.message, mine && styles.mine, tone === 'assistant' && styles.assistant]
    .filter(Boolean)
    .join(' ')
  return (
    <li className={classes}>
      <Avatar name={name} tone={mine ? 'mine' : tone} />
      <div className={styles.body}>
        <div className={styles.who}>
          <strong>{name}</strong>
          {role && <span>{role}</span>}
        </div>
        <div className={styles.bubble}>
          <p className={styles.text}>{text}</p>
          {translation && <TranslationLine {...translation} />}
        </div>
        <div className={styles.meta}>
          <time>{time}</time>
          {tag && <span className={styles.tag}>{tag}</span>}
        </div>
      </div>
    </li>
  )
}
