import styles from "./safe-code-form.module.css";
import type { ChangeEvent, RefObject } from "react";
import { useSafeGameContext } from "../model/safe-game-context";

export function SafeCodeForm({
  inputRef,
  revealedCode,
  feedbackLive,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  revealedCode: number | null;
  feedbackLive: boolean;
}) {
  const { state, changeGuessInput, submitGuess } = useSafeGameContext();
  const terminal = state.phase !== "playing";

  function submit() {
    if (!terminal) submitGuess();
  }

  function changeInput(event: ChangeEvent<HTMLInputElement>) {
    const nextInput = event.target.value;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    const undoingToLongerInput =
      inputType === "historyUndo" && nextInput.length > state.input.length;
    const redoingToShorterInput =
      inputType === "historyRedo" && nextInput.length < state.input.length;
    const deleting =
      inputType?.startsWith("delete") ||
      (inputType === "historyUndo" && !undoingToLongerInput) ||
      redoingToShorterInput;
    changeGuessInput(nextInput, deleting ? "delete" : "insert");
  }

  return (
    <form
      className={styles.codeEntry}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label className={styles.visuallyHidden} htmlFor="safe-code">
        Safe code
      </label>
      <div className={styles.shell}>
        <input
          className={styles.codeInput}
          id="safe-code"
          ref={inputRef}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Enter a number..."
          value={state.input}
          disabled={terminal}
          aria-invalid={
            state.feedback === "invalid" ||
            state.feedback === "wrong" ||
            undefined
          }
          aria-describedby="safe-feedback"
          onChange={changeInput}
        />
        <button
          className={styles.codeInputButton}
          disabled={terminal}
          type="submit"
        >
          OK
        </button>
      </div>
      <p
        id="safe-feedback"
        className={styles.feedback}
        role={feedbackLive ? "status" : undefined}
      >
        {state.feedback === "invalid" && "Enter a whole number from 1 to 1000."}
        {state.feedback === "wrong" && "Incorrect code, try again."}
        {state.feedback === "won" && "Safe opened!"}
        {state.feedback === "surrendered" &&
          `Round ended. The code was ${revealedCode}.`}
      </p>
    </form>
  );
}
