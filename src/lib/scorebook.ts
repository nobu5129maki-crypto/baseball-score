import { PLAY_SHORT } from "./labels";
import { battingSide, reduceGame } from "./engine";
import { POSITION_SHORT } from "./types";
import type { Game, PlayEvent, Position } from "./types";

export type BookCell = {
  result: string;
  field?: Position;
  label: string;
};

export function buildScorebook(game: Game): BookCell[][][][] {
  const rows = 9;
  const cols = Math.max(12, game.scheduledInnings);
  const grid: BookCell[][][][] = Array.from({ length: 2 }, () =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => [] as BookCell[])),
  );

  let cursor: Game = { ...game, events: [] };
  for (const event of game.events) {
    if (event.t !== "play") {
      cursor = { ...cursor, events: [...cursor.events, event] };
      continue;
    }
    const before = reduceGame(cursor);
    const play = event as PlayEvent;
    const sideIdx = battingSide(before.half) === "first" ? 0 : 1;
    const order = before.lineupIndex[battingSide(before.half)];
    const inning = before.inning - 1;
    if (inning >= 0 && inning < cols && order >= 0 && order < rows) {
      const field = play.field;
      const label = field
        ? `${POSITION_SHORT[field]}${PLAY_SHORT[play.result]}`
        : PLAY_SHORT[play.result];
      grid[sideIdx][order][inning].push({ result: play.result, field, label });
    }
    cursor = { ...cursor, events: [...cursor.events, event] };
  }
  return grid;
}
