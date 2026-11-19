import { Fragment, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { Pill } from './Pill'
import styles from './JobFlow.module.css'

export interface JobFlowStepView {
  id: string
  icon: IconName
  who: string
  what: string
  unknown: boolean
  note?: ReactNode
}

export function JobFlowStep({ step, unknownLabel }: { step: JobFlowStepView; unknownLabel: string }) {
  return (
    <li className={`${styles.step} ${step.unknown ? styles.unknown : ''}`}>
      <span className={styles.icon}>
        <Icon name={step.unknown ? 'question' : step.icon} size={24} />
      </span>
      <div>
        {step.unknown && <Pill tone="amber">{unknownLabel}</Pill>}
        <strong>{step.who}</strong>
        <p>{step.what}</p>
        {step.note}
      </div>
    </li>
  )
}

// Drawn from a list of steps: a column on phones, a row on desktop.
export function JobFlow({ steps, unknownLabel }: { steps: JobFlowStepView[]; unknownLabel: string }) {
  return (
    <ol className={styles.flow}>
      {steps.map((step, index) => (
        <Fragment key={step.id}>
          {index > 0 && (
            <li className={styles.arrow} aria-hidden="true">
              <span className={styles.down}>
                <Icon name="arrowDown" />
              </span>
              <span className={styles.across}>
                <Icon name="arrowRight" />
              </span>
            </li>
          )}
          <JobFlowStep step={step} unknownLabel={unknownLabel} />
        </Fragment>
      ))}
    </ol>
  )
}
