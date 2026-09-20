import type { EarnedHintFact } from "../domain";
import type { KeyboardEvent } from "react";
import styles from "./stored-hints-card.module.css";

export function factText(fact: EarnedHintFact) {
  if (fact.kind === "parity") return `The code is ${fact.parity}.`;
  if (fact.kind === "divisibility")
    return fact.relation === "divisible"
      ? `The code is divisible by ${fact.divisor}.`
      : `The code is not divisible by ${fact.divisor}.`;
  return `The code is between ${fact.minimum} and ${fact.maximum}.`;
}

function scrollStoredHints(event: KeyboardEvent<HTMLUListElement>) {
  const list = event.currentTarget;
  const rowStep = 28;
  const nextTop =
    event.key === "End"
      ? list.scrollHeight
      : event.key === "Home"
        ? 0
        : event.key === "PageDown"
          ? list.scrollTop + list.clientHeight
          : event.key === "PageUp"
            ? list.scrollTop - list.clientHeight
            : event.key === "ArrowDown"
              ? list.scrollTop + rowStep
              : event.key === "ArrowUp"
                ? list.scrollTop - rowStep
                : null;
  if (nextTop === null) return;
  event.preventDefault();
  list.scrollTop = nextTop;
}

export function StoredHintsCard({
  facts,
}: {
  facts: readonly EarnedHintFact[];
}) {
  return (
    <section
      id="stored-hints-card"
      className={styles.card}
      aria-label="Stored hints"
    >
      <h2>Stored hints</h2>
      <ul
        aria-label="Stored hint list"
        tabIndex={0}
        onKeyDown={scrollStoredHints}
      >
        {facts.map((fact) => (
          <li key={fact.id}>{factText(fact)}</li>
        ))}
      </ul>
    </section>
  );
}
