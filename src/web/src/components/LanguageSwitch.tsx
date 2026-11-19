import type { Lang } from '../projects/types'
import styles from './LanguageSwitch.module.css'

// Each language is named in its own language, so these labels are not translated.
const options: { code: Lang; short: string; full: string }[] = [
  { code: 'en', short: 'EN', full: 'English' },
  { code: 'tr', short: 'TR', full: 'Türkçe' },
]

interface Props {
  value: Lang
  onChange: (lang: Lang) => void
  label: string
}

export function LanguageSwitch({ value, onChange, label }: Props) {
  return (
    <div className={styles.switch} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          title={option.full}
          aria-label={option.full}
          aria-pressed={value === option.code}
          onClick={() => onChange(option.code)}
        >
          {option.short}
        </button>
      ))}
    </div>
  )
}
