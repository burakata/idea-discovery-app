import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoStore } from '../state/demoStore'
import { useT } from '../strings'
import { useDemoT } from '../strings/demo'
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
  const { state, viewer, dispatch } = useDemoStore()
  const { t, personName } = useT()
  const d = useDemoT().preview
  const navigate = useNavigate()
  const isDesktop = useIsDesktop()

  const people = Object.values(state.people).filter((person) => person.role !== 'assistant')

  const reset = () => {
    dispatch({ type: 'reset' })
    navigate('/')
  }

  return (
    <div className={styles.bar}>
      <span className={styles.tag}>
        <Icon name="info" size={16} />
        <span className={styles.long}>{d.label}</span>
        <span className={styles.short}>{d.short}</span>
      </span>
      <span className={styles.explain}>{d.explain}</span>
      {state.signedIn && (
      <label className={styles.viewAs}>
        <span>{d.viewAs}</span>
        <select
          aria-label={d.viewAs}
          value={viewer.id}
          onChange={(event) => dispatch({ type: 'viewAs', id: event.target.value })}
        >
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {personName(person)}
              {/* On phones the name alone fits; the role would be cut off. */}
              {isDesktop && ` · ${t.roles[person.role]}`}
            </option>
          ))}
        </select>
      </label>
      )}
      <button type="button" className={styles.reset} onClick={reset}>
        <Icon name="reset" size={16} />
        <span>{d.reset}</span>
      </button>
    </div>
  )
}
