import styles from "./page.module.css";
import { SafeGameScreen } from "@/features/safe-game";

export default function Home() {
  return <div className={styles.background}><SafeGameScreen /></div>;
}
