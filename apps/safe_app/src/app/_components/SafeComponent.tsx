"use client";

import styles from "./SafeComponent.module.css";

export default function SafeComponent({ safeOpen }: { safeOpen: boolean }) {
  return <div aria-label={safeOpen ? "Safe opened" : "Safe closed"} className={`${styles.safeContainer} ${safeOpen ? styles.safeOpen : styles.safeClose}`} />;
}
