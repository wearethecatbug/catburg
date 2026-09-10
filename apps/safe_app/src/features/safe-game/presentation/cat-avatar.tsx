import styles from "./cat-avatar.module.css";
import type React from "react";
import type { CatReaction } from "../domain/game.types";

const skinByReaction: Record<CatReaction, string> = { idle: "pet", hover: "thanks", wrong: "fail", won: "shocked", surrendered: "fail" };

export function CatAvatar({ reaction, onMouseEnter, onMouseLeave }: { reaction: CatReaction; onMouseEnter: () => void; onMouseLeave: () => void }) {
  return <div aria-label={`Cat ${reaction}`} className={styles.catContainer} style={{ "--cat-image": `url(/${skinByReaction[reaction]}.png)` } as React.CSSProperties} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
}
