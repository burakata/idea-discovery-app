import { LANG_LABELS, LANGS, type Lang } from '../languages'
import styles from './LanguageSwitch.module.css'

interface Props {
  value: Lang
  onChange: (lang: Lang) => void
  label: string
}

export function LanguageSwitch({ value, onChange, label }: Props) {
  return (
    <div className={styles.switch} role="group" aria-label={label}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          title={LANG_LABELS[code].full}
          aria-label={LANG_LABELS[code].full}
          aria-pressed={value === code}
          onClick={() => onChange(code)}
        >
          {LANG_LABELS[code].short}
        </button>
      ))}
    </div>
  )
}
