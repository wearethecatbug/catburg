"use client";

import styles from "./LogView.module.css";

export default function LogView({ attempts }: { attempts: number[] }) {
  return <section className={styles.logViewContainer} aria-live="polite"><h2>History</h2>{attempts.length === 0 ? <p>No valid attempts yet.</p> : <ol>{attempts.map((attempt) => <li key={attempt}>{attempt}</li>)}</ol>}</section>;
}
