import { describe, expect, it } from "vitest";
import { commitEnd, commitPinchHitter, commitPlay, commitSteal, commitSub } from "./engine";
import { buildScorebook } from "./scorebook";
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

describe("buildScorebook", () => {
  it("ヒットが先攻1番の1回に入る", () => {
    const game = commitPlay(makeGame(), "single", undefined, "LF");
    const book = buildScorebook(game);
    const marks = book.first.orders[0].innings[0].map((m) => m.label);
    expect(marks).toContain("左安");
    expect(book.innings).toBe(7);
  });

  it("代打の名前が同じ打順に残る", () => {
    let game = commitPinchHitter(makeGame(), "PH1", "代打太");
    game = commitPlay(game, "single", undefined, "RF");
    const row = buildScorebook(game).first.orders[0];
    expect(row.players.map((p) => p.name)).toEqual(["A1", "代打太"]);
    expect(row.players[1].via).toBe("ph");
    expect(row.innings[0].map((m) => m.label)).toEqual(["代打", "右安"]);
  });

  it("盗塁が走者の打順と回に入る", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitSteal(game, 1, 2);
    const book = buildScorebook(game);
    expect(book.first.orders[0].innings[0].map((m) => m.label)).toContain("盗");
  });

  it("試合終了後も打席がスコアブックに残る", () => {
    let game = commitPlay(makeGame(), "strikeout");
    game = commitEnd(game);
    const book = buildScorebook(game);
    expect(book.first.orders[0].innings[0].map((m) => m.label)).toContain("三振");
  });

  it("同じ選手の守備位置変更は名前を増やさない", () => {
    const game = commitSub(makeGame(), "first", 1, "A1", "A1", "LF");
    const row = buildScorebook(game).first.orders[0];
    expect(row.players).toHaveLength(1);
    expect(row.players[0].position).toBe("LF");
  });
});
