import { describe, expect, it } from "vitest";
import { gamesKeptAfterDateChange, sortGamesForHome, splitGamesByStatus } from "./game-list";
import type { Game } from "./types";

function game(over: Partial<Game> & Pick<Game, "id">): Game {
  return {
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "相手",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-10-24",
    status: "ended",
    firstLineup: [],
    secondLineup: [],
    events: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe("gamesKeptAfterDateChange", () => {
  it("日付が変わっても昨日や一昨日の試合を捨てない", () => {
    const rows = [
      game({ id: "old-ended", date: "2026-10-23", status: "ended", updatedAt: 10 }),
      game({ id: "old-live", date: "2026-10-24", status: "in_progress", updatedAt: 20 }),
      game({ id: "today", date: "2026-10-25", status: "lineup", updatedAt: 30 }),
    ];
    const kept = gamesKeptAfterDateChange(rows, "2026-10-25");
    expect(kept.map((g) => g.id)).toEqual(["old-ended", "old-live", "today"]);
  });
});

describe("sortGamesForHome", () => {
  it("updatedAt が無い試合も落とさず、新しい順に並べる", () => {
    const rows = [
      game({ id: "mid", updatedAt: 2 }),
      game({ id: "old", updatedAt: undefined as unknown as number }),
      game({ id: "new", updatedAt: 9 }),
    ];
    expect(sortGamesForHome(rows).map((g) => g.id)).toEqual(["new", "mid", "old"]);
  });
});

describe("splitGamesByStatus", () => {
  it("進行中・準備中・終了を日付に関係なく分ける", () => {
    const split = splitGamesByStatus([
      game({ id: "a", status: "in_progress", date: "2026-01-01" }),
      game({ id: "b", status: "lineup", date: "2025-12-31" }),
      game({ id: "c", status: "ended", date: "2024-04-01" }),
    ]);
    expect(split.active.map((g) => g.id)).toEqual(["a"]);
    expect(split.setup.map((g) => g.id)).toEqual(["b"]);
    expect(split.done.map((g) => g.id)).toEqual(["c"]);
  });
});
