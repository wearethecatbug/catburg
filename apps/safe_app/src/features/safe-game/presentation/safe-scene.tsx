"use client";

import styles from "./safe-scene.module.css";

export function SafeScene({ safeOpen, dialAngle }: { safeOpen: boolean; dialAngle: number }) {
  return <div aria-label={safeOpen ? "Safe opened" : "Safe closed"} className={`${styles.safeContainer} ${safeOpen ? styles.safeOpen : styles.safeClose}`}>
    <span className={styles.art} style={{ backgroundImage: `url(/safe-cat/${safeOpen ? "safe-open-720.webp" : "safe-closed-720.webp"})` }} />
    {!safeOpen && <span aria-hidden="true" className={styles.dial} style={{ backgroundImage:"url(/safe-cat/safe-dial-256.webp)", transform: `rotate(${dialAngle}deg)` }} />}
  </div>;
}
