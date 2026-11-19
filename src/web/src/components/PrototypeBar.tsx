import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/store'
import { useT } from '../strings'
import { Icon } from './Icon'
import styles from './PrototypeBar.module.css'

const desktop = window.matchMedia('(min-width: 900px)')

function useIsDesktop() {
  const [matches, setMatches] = useState(desktop.matches)
  useEffect(() => {
    const update = () => setMatches(desktop.matches)
    desktop.addEventListener('change', update)
    return () => desktop.removeEventListener('change', update)
  }, [])
  return matches
}

// Prototype-only controls. The real app has no "View as": each person has
// their own device and invite link.
export function PrototypeBar() {
  const { state, viewer, dispatch } = useStore()
  const { t, lang, personName } = useT()
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const people = Object.values(state.people).filter((person) => person.role !== 'assistant')

  const reset = () => {
    dispatch({ type: 'reset' })
    navigate('/')
  }

  return (
    <div className={styles.bar}>
      <span className={styles.tag}>
        <Icon name="info" size={16} />
        <span className={styles.long}>{t.preview.label}</span>
        <span className={styles.short}>{t.preview.short}</span>
      </span>
      <span className={styles.explain}>{t.preview.explain}</span>
      <label className={styles.viewAs}>
        <span>{t.preview.viewAs}</span>
        <select
          aria-label={t.preview.viewAs}
          value={viewer.id}
          onChange={(event) => dispatch({ type: 'viewAs', id: event.target.value })}
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {personName(person)}
              {/* On phones the name alone fits; the role would be cut off. */}
              {isDesktop && ` · ${t.roles[person.role]}`}
              {isDesktop && !person.joined && ` (${t.preview.notJoined})`}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className={styles.reset} onClick={reset}>
        <Icon name="reset" size={16} />
        <span>{t.preview.reset}</span>
      </button>
    </div>
  )
}
