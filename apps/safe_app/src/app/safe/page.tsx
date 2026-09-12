import { SafeGameScreen } from "@/features/safe-game";
import styles from "./page.module.css";

export default function SafePage() {
  return <div className={styles.surface}><SafeGameScreen /></div>;
}
