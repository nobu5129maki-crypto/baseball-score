"use client";

import { use } from "react";
import { LineupScreen } from "@/components/LineupScreen";

export default function LineupPage({ params }: PageProps<"/games/[id]/lineup">) {
  const { id } = use(params);
  return <LineupScreen gameId={id} />;
}
