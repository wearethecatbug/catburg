import type { EarnedHintFact } from "../domain";
import styles from "./stored-hints-card.module.css";

export function factText(fact: EarnedHintFact) {
  if (fact.kind === "parity") return `The code is ${fact.parity}.`;
  if (fact.kind === "divisibility") return fact.relation === "divisible" ? `The code is divisible by ${fact.divisor}.` : `The code is not divisible by ${fact.divisor}.`;
  return `The code is between ${fact.minimum} and ${fact.maximum}.`;
}
export function StoredHintsCard({ facts, onPointerEnter, onPointerLeave }: { facts: readonly EarnedHintFact[]; onPointerEnter?: () => void; onPointerLeave?: () => void }) {
 return <section id="stored-hints-card" className={styles.card} aria-label="Stored hints" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}><h2>Stored hints</h2><ul>{facts.map((fact) => <li key={fact.id}>{factText(fact)}</li>)}</ul></section>;
}
