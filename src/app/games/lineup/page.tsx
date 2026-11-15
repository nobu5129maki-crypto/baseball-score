"use client";

import { GameRoute } from "@/components/GameRoute";
import { LineupScreen } from "@/components/LineupScreen";

export default function LineupPage() {
  return <GameRoute>{(id) => <LineupScreen gameId={id} />}</GameRoute>;
}
