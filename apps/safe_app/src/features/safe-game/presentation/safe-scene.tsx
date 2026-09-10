"use client";

import styles from "./safe-scene.module.css";

export function SafeScene({ safeOpen }: { safeOpen: boolean }) {
  return <div aria-label={safeOpen ? "Safe opened" : "Safe closed"} className={`${styles.safeContainer} ${safeOpen ? styles.safeOpen : styles.safeClose}`} />;
}
