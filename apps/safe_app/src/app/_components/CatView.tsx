import styles from "./CatView.module.css";
import type React from "react";
import type { CatReaction } from "@/domain/safe-game";

const skinByReaction: Record<CatReaction, string> = { idle: "pet", hover: "thanks", wrong: "fail", won: "shocked", surrendered: "fail" };

export default function CatView({ reaction, onMouseEnter, onMouseLeave }: { reaction: CatReaction; onMouseEnter: () => void; onMouseLeave: () => void }) {
  return <div aria-label={`Cat ${reaction}`} className={styles.catContainer} style={{ "--bgSrc": `url(/${skinByReaction[reaction]}.png)` } as React.CSSProperties} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} />;
}
