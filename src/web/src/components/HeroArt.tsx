import styles from './HeroArt.module.css'

// People around a table with a lightbulb and a speech bubble: an idea being talked through.
export function HeroArt() {
  return (
    <svg className={styles.art} viewBox="0 0 360 270" aria-hidden="true">
      <ellipse className={styles.ground} cx="180" cy="236" rx="150" ry="18" />
      <path className={styles.legs} d="M140 196v36M220 196v36" />
      <circle className={styles.person} cx="100" cy="124" r="19" />
      <path className={styles.body} d="M70 184q0-36 30-36t30 36z" />
      <circle className={styles.person} cx="180" cy="106" r="19" />
      <path className={styles.body} d="M150 170q0-36 30-36t30 36z" />
      <circle className={styles.person} cx="260" cy="124" r="19" />
      <path className={styles.body} d="M230 184q0-36 30-36t30 36z" />
      <ellipse className={styles.table} cx="180" cy="188" rx="104" ry="20" />
      <circle className={styles.bulb} cx="180" cy="46" r="18" />
      <path className={styles.detail} d="M172 70h16M175 77h10M180 16v-6M156 26l-4-4M204 26l4-4" />
      <path className={styles.bubble} d="M262 40h50a12 12 0 0 1 12 12v18a12 12 0 0 1-12 12h-32l-14 14v-14h-4a12 12 0 0 1-12-12V52a12 12 0 0 1 12-12z" />
      <path className={styles.detail} d="M274 61h1M286 61h1M298 61h1" />
    </svg>
  )
}
