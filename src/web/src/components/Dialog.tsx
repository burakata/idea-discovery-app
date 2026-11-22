import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import styles from './Dialog.module.css'

interface Props {
  title: string
  // Called for the close button, Escape and a click on the backdrop. The parent
  // stops drawing the dialog, so whatever it held goes with it.
  onClose: () => void
  children: ReactNode
  closeLabel: string
}

// A modal dialog: the browser keeps focus inside it and closes it on Escape. It
// opens on the first thing marked data-autofocus (the safe choice in a
// confirmation) and gives focus back to what opened it.
export function Dialog({ title, onClose, children, closeLabel }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      dialog.close()
      if (opener?.isConnected) opener.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) onClose()
      }}
    >
      <div className={styles.head}>
        <h2 id={titleId}>{title}</h2>
        <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
