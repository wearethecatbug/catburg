"use client";

import styles from "./Page.module.css";

import { Audiowide } from "next/font/google";
import SafeContainer from "@/components/safe/SafeContainer";
import { useSafeReducer } from "@/components/safe/SafeContainerReducer";
import { SafeMenu } from "@/components/safe/safeMenu/SafeMenu";

const audiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
});

export default function Home() {
  const [state, dispatch] = useSafeReducer();

  return (
    <div className={styles.background}>
      <p className={styles.headerText}>
        The safe code is a number that ranges from 1 to 1000
      </p>
      <SafeContainer />
      <SafeMenu />
    </div>
  );
}
//
// <SafeSettings inputCodeRangeNumbers={{ firstNumberCodeRange, setFirstNumberCodeRange, secondNumberCodeRange, setSecondNumberCodeRange}} inputHintRangeNumbers={{firstNumberHintRange, setFirstNumberHintRange, secondNumberHintRange, setSecondNumberHintRange}} ></SafeSettings>
//<div className={styles.logWrapper}>
//                     {state.isLogVisible && <LogView ref={logViewRef} logs={state.logs} />}
//                 </div>
//

// <SignsProvider>
//                                 <QuestionProvider firstNumberHintRange={firstNumberHintRange} secondNumberHintRange={secondNumberHintRange}>
//
//                                     {state.isHintVisible && (
//                                         <HintPopupView onCloseHintAction={() => {
//                                             dispatch({type: SAFE_ACTION.TOGGLE_HINT});
//                                             setSafeCodeInputFocused((value) => true);
//                                         }
//                                         } getButtonClass={getButtonClass}
//                                                         onGiveUpHintChange={setIsGiveUpHintActive} firstNumberHintRange={firstNumberHintRange}
//                                                         setFirstNumberHintRange={setFirstNumberHintRange}
//                                                         secondNumberHintRange={secondNumberHintRange}
//                                                         setSecondNumberHintRange={setSecondNumberHintRange} />
//                                     )}
//                                 </QuestionProvider>
//                             </SignsProvider>