import { describe, expect, it } from "vitest";
import { opponentBenchPlayers, rememberOpponentBench } from "./opponent-bench";
import type { Game } from "./types";

function game(over: Partial<Game> = {}): Game {
  return {
    id: "g1",
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "太陽",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-09-05",
    status: "in_progress",
    firstLineup: [],
    secondLineup: [],
    events: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

describe("rememberOpponentBench", () => {
  it("外れた選手を控えに足す", () => {
    const next = rememberOpponentBench(game(), {
      playerId: "opp-1",
      playerName: "山田",
      number: "8",
    });
    expect(next.opponentBench).toEqual([{ playerId: "opp-1", playerName: "山田", number: "8" }]);
  });

  it("同じ選手は二重に足さない", () => {
    const start = game({
      opponentBench: [{ playerId: "opp-1", playerName: "山田", number: "8" }],
    });
    const next = rememberOpponentBench(start, {
      playerId: "opp-1",
      playerName: "山田",
      number: "8",
    });
    expect(next.opponentBench).toHaveLength(1);
    expect(next).toBe(start);
  });
});

describe("opponentBenchPlayers", () => {
  it("代打シート用の形に変換する", () => {
    expect(
      opponentBenchPlayers(
        game({
          opponentBench: [{ playerId: "b1", playerName: "控え太", number: "99" }],
        }),
      ),
    ).toEqual([{ id: "b1", name: "控え太", number: "99" }]);
  });
});
