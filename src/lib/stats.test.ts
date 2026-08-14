import { describe, expect, it } from "vitest";
import { commitPlay } from "./engine";
import { atBatsThisGame } from "./stats";
import type { Game, LineupSlot, Position } from "./types";

function slot(order: number, prefix: string, position: Position): LineupSlot {
  return { order, playerId: `${prefix}${order}`, playerName: `${prefix}${order}`, position };
}

function lineup(prefix: string): LineupSlot[] {
  const positions: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  return positions.map((position, i) => slot(i + 1, prefix, position));
}

function makeGame(): Game {
  return {
    id: "g1",
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "相手",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-08-13",
    status: "in_progress",
    firstLineup: lineup("A"),
    secondLineup: lineup("B"),
    events: [],
    createdAt: 1,
    updatedAt: 1,
  };
}

describe("atBatsThisGame", () => {
  it("今試合の打席結果を回と内容で返す", () => {
    let game = commitPlay(makeGame(), "single", undefined, "LF");
    for (let i = 0; i < 14; i++) game = commitPlay(game, "groundout");
    game = commitPlay(game, "strikeout");
    const notes = atBatsThisGame(game, { playerId: "A1", order: 1 }, "top");
    expect(notes).toEqual([
      { inning: 1, half: "top", label: "左安", result: "single" },
      { inning: 3, half: "top", label: "三振", result: "strikeout" },
    ]);
  });
});
