import { factText } from "./stored-hints-card";
import type { EarnedHintFact } from "../domain";
import styles from "./reward-presentation.module.css";
export function RewardPresentation({ fact }: { fact: EarnedHintFact }) {
  const text = factText(fact);
  return (
    <div className={styles.reward} role="img" aria-label="New hint reward">
      <img
        src="/safe-cat/cat-hint-reward-lying-1448.png"
        alt=""
        draggable={false}
      />
      <p>{text}</p>
    </div>
  );
}
