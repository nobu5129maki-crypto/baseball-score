"use client";

import { GameRoute } from "@/components/GameRoute";
import { ScoreScreen } from "@/components/ScoreScreen";

export default function ScorePage() {
  return <GameRoute>{(id) => <ScoreScreen gameId={id} />}</GameRoute>;
}
