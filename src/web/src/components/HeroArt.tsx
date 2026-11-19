import styles from './HeroArt.module.css'

// Warehouse, pallet and van. Redrawn from the reference prototype's hero artwork.
export function HeroArt() {
  return (
    <svg className={styles.art} viewBox="0 0 360 270" aria-hidden="true">
      <ellipse className={styles.ground} cx="170" cy="229" rx="153" ry="18" />
      <path className={styles.wall} d="M45 117L143 43 239 117V222H45Z" />
      <rect className={styles.door} x="83" y="127" width="121" height="95" />
      <path className={styles.rail} d="M83 148H204" />
      <path className={styles.boxes} d="M99 206v-30h32v30m0 0v-30h32v30m-47-30v-28h32v28m32 0v-28h-32" />
      <path className={styles.pallet} d="M92 210h112v8H92z" />
      <path className={styles.van} d="M220 181h61l31 23v20h-92z" />
      <path className={styles.cab} d="M281 181v23h31" />
      <circle className={styles.wheel} cx="242" cy="225" r="13" />
      <circle className={styles.wheel} cx="291" cy="225" r="13" />
    </svg>
  )
}
