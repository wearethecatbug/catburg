import styles from "./safe-code-form.module.css";
import type { RefObject } from "react";
import { useSafeGameContext } from "../model/safe-game-context";

export function SafeCodeForm({ inputRef, revealedCode }: { inputRef: RefObject<HTMLInputElement | null>; revealedCode: number | null }) {
  const { state, changeGuessInput, submitGuess } = useSafeGameContext();
  const terminal = state.phase !== "playing";
  function submit() { if (!terminal) submitGuess(); }
  return <form className={styles.codeEntry} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <label className={styles.visuallyHidden} htmlFor="safe-code">Safe code</label>
    <input className={styles.codeInput} id="safe-code" ref={inputRef} inputMode="numeric" autoComplete="off" value={state.input} disabled={terminal} aria-describedby="safe-feedback" onChange={(event) => changeGuessInput(event.target.value)} />
    <button className={styles.codeInputButton} disabled={terminal} type="submit">OK</button>
    <p id="safe-feedback" className={styles.feedback} role="status">
      {state.feedback === "invalid" && "Enter a whole number from 1 to 1000."}
      {state.feedback === "wrong" && "Incorrect code, try again."}
      {state.feedback === "won" && "Safe opened!"}
      {state.feedback === "surrendered" && `Round ended. The code was ${revealedCode}.`}
    </p>
  </form>;
}
