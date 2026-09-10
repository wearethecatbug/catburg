"use client";

import styles from "./Page.module.css";
import SafeContainer from "@/components/safe/SafeContainer";

export default function Home() {
  return <div className={styles.background}><SafeContainer /></div>;
}
