import { factText } from "./stored-hints-card";
import type { EarnedHintFact } from "../domain";
import styles from "./reward-presentation.module.css";
export function RewardPresentation({ fact }: { fact: EarnedHintFact }) { const text = factText(fact); return <div className={styles.reward} aria-label="New hint reward"><img src="/safe-cat/cat-hint-reward-640.webp" alt="" /><p>{text}</p></div>; }
