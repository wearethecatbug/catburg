import styles from "./SafeCodeInput.module.css";
import type { RefObject } from "react";
import { useSafeContext } from "@/components/safe/SafeContainerContext";

export default function SafeCodeInput({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const { state, dispatch } = useSafeContext();
  const terminal = state.phase !== "playing";
  function submit() { if (!terminal) dispatch({ type: "submit-guess" }); }
  return <form className={styles.SafeCodeInputContainer} onSubmit={(event) => { event.preventDefault(); submit(); }}>
    <label className={styles.visuallyHidden} htmlFor="safe-code">Safe code</label>
    <input className={styles.CodeInput} id="safe-code" ref={inputRef} inputMode="numeric" autoComplete="off" value={state.input} disabled={terminal} aria-describedby="safe-feedback" onChange={(event) => dispatch({ type: "set-input", input: event.target.value })} />
    <button className={styles.CodeInputButton} disabled={terminal} type="submit">OK</button>
    <p id="safe-feedback" className={styles.feedback} role="status">
      {state.feedback === "invalid" && "Enter a whole number from 1 to 1000."}
      {state.feedback === "wrong" && "Incorrect code, try again."}
      {state.feedback === "won" && "Safe opened!"}
      {state.feedback === "surrendered" && `Round ended. The code was ${state.revealedCode}.`}
    </p>
  </form>;
}
