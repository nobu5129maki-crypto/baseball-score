import type { GameState, Side } from "./types";

export type InningCell = number | "X" | null;

export function halfInningStarted(
  state: Pick<GameState, "inning" | "half" | "bottomUnplayed">,
  side: Side,
  inning: number,
): boolean {
  if (inning < 1) return false;
  if (state.inning > inning) return true;
  if (state.inning < inning) return false;
  if (side === "first") return true;
  return state.half === "bottom" && !state.bottomUnplayed;
}

/** 未開始の半イニングは null（表示は ·）。裏を省略した規定回は X。 */
export function inningScoreCells(
  scores: number[],
  cols: number,
  state: Pick<GameState, "inning" | "half" | "bottomUnplayed">,
  side: Side,
): InningCell[] {
  return Array.from({ length: cols }, (_, i) => {
    const inning = i + 1;
    if (state.bottomUnplayed && side === "second" && inning === state.inning) return "X";
    if (!halfInningStarted(state, side, inning)) return null;
    return scores[i] ?? 0;
  });
}
