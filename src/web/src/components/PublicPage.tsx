import type { ReactNode } from 'react'
import type { Lang } from '../languages'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { Icon } from './Icon'
import { LanguageSwitch } from './LanguageSwitch'
import styles from './PublicPage.module.css'

interface Props {
  children: ReactNode
  // Called after the visitor changes the language switch (the sign-in page needs to know).
  onLanguageChange?: (lang: Lang) => void
}

// The page around the signed-out screens: the app's name, the language switch,
// and room for one card. It shows nothing about any project.
export function PublicPage({ children, onLanguageChange }: Props) {
  const { language, setLanguage } = useStore()
  const { t } = useT()

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.mark}>
            <Icon name="brand" size={22} />
          </span>
          <strong>{t.app.name}</strong>
        </div>
        <LanguageSwitch
          value={language}
          onChange={(next) => {
            setLanguage(next)
            onLanguageChange?.(next)
          }}
          label={t.language.label}
        />
      </header>
      <main className={styles.body}>
        <div className={styles.inner}>{children}</div>
      </main>
    </div>
  )
}
