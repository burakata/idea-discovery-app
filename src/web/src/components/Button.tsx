import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import styles from './Button.module.css'

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'primary' | 'secondary' | 'quiet'
  size?: 'md' | 'sm'
  icon?: IconName
  iconRight?: IconName
  wide?: boolean
  // Shows the icon alone; the text stays as the accessible name and tooltip.
  iconOnly?: boolean
  // Colour used while aria-pressed is true (reaction buttons).
  tone?: 'positive' | 'negative'
  to?: string
  href?: string
  children: ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconRight,
  wide,
  iconOnly,
  tone,
  to,
  href,
  children,
  className,
  ...rest
}: Props) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'sm' && styles.small,
    wide && styles.wide,
    iconOnly && styles.iconOnly,
    tone && styles[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {icon && <Icon name={icon} size={18} />}
      <span className={iconOnly ? styles.hidden : undefined}>{children}</span>
      {iconRight && <Icon name={iconRight} size={18} />}
    </>
  )

  if (to) {
    return (
      <Link className={classes} to={to}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a className={classes} href={href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    )
  }
  return (
    <button
      type="button"
      className={classes}
      title={iconOnly && typeof children === 'string' ? children : undefined}
      {...rest}
    >
      {content}
    </button>
  )
}
