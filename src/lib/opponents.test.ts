import { describe, expect, it } from "vitest";
import { recentOpponentNames, recentTournamentNames, recentVenueNames } from "./opponents";
import type { Game } from "./types";

function game(over: Partial<Game> & Pick<Game, "id" | "opponentName" | "updatedAt">): Game {
  return {
    myTeamId: "t1",
    myTeamName: "ひまわり",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-08-31",
    status: "ended",
    firstLineup: [],
    secondLineup: [],
    events: [],
    createdAt: 1,
    ...over,
  };
}

describe("recentOpponentNames", () => {
  it("新しい試合の相手から順に、重複なく返す", () => {
    const names = recentOpponentNames([
      game({ id: "a", opponentName: "太陽", updatedAt: 1 }),
      game({ id: "b", opponentName: "北斗", updatedAt: 3 }),
      game({ id: "c", opponentName: "太陽", updatedAt: 2 }),
      game({ id: "d", opponentName: " 北斗 ", updatedAt: 4 }),
    ]);
    expect(names).toEqual(["北斗", "太陽"]);
  });

  it("件数を上限で切る", () => {
    const games = Array.from({ length: 5 }, (_, i) =>
      game({ id: String(i), opponentName: `相手${i}`, updatedAt: i }),
    );
    expect(recentOpponentNames(games, 3)).toEqual(["相手4", "相手3", "相手2"]);
  });
});

describe("recentVenueNames", () => {
  it("新しい試合の場所から順に、重複なく返す", () => {
    const names = recentVenueNames([
      game({ id: "a", opponentName: "A", venue: "市民球場", updatedAt: 1 }),
      game({ id: "b", opponentName: "B", venue: "中央公園", updatedAt: 3 }),
      game({ id: "c", opponentName: "C", venue: "市民球場", updatedAt: 2 }),
      game({ id: "d", opponentName: "D", venue: " 中央公園 ", updatedAt: 4 }),
      game({ id: "e", opponentName: "E", updatedAt: 5 }),
    ]);
    expect(names).toEqual(["中央公園", "市民球場"]);
  });
});

describe("recentTournamentNames", () => {
  it("新しい試合の大会名から順に、重複なく返す", () => {
    const names = recentTournamentNames([
      game({ id: "a", opponentName: "A", tournament: "春季大会", updatedAt: 1 }),
      game({ id: "b", opponentName: "B", tournament: "市民リーグ", updatedAt: 3 }),
      game({ id: "c", opponentName: "C", tournament: "春季大会", updatedAt: 2 }),
      game({ id: "d", opponentName: "D", tournament: " 市民リーグ ", updatedAt: 4 }),
      game({ id: "e", opponentName: "E", updatedAt: 5 }),
    ]);
    expect(names).toEqual(["市民リーグ", "春季大会"]);
  });
});
