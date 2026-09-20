"use client";

import { SafeGameScreen } from "@/features/safe-game";
import { fixedRoundSource } from "../fixed-round-source";

export default function Page() {
  return <SafeGameScreen roundSource={fixedRoundSource} />;
}
