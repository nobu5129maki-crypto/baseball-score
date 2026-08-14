import { describe, expect, it } from "vitest";
import { commitPinchHitter, commitPlay } from "./engine";
import { atBatsThisGame, batterLine } from "./stats";
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

  it("代打は同じ打順でも前の打者の打席を出さない", () => {
    let game = makeGame();
    for (let i = 0; i < 18; i++) game = commitPlay(game, "strikeout");
    game = commitPinchHitter(game, "PH1", "代打太");
    expect(atBatsThisGame(game, { playerId: "PH1", order: 1 }, "top")).toEqual([]);
    expect(atBatsThisGame(game, { playerId: "A1", order: 1 }, "top")).toEqual([
      { inning: 1, half: "top", label: "三振", result: "strikeout" },
    ]);
  });
});

describe("batterLine", () => {
  it("日本式の打数安打で出す", () => {
    expect(
      batterLine({
        playerId: "1",
        name: "A",
        order: 1,
        side: "first",
        ab: 3,
        h: 1,
        bb: 0,
        hbp: 0,
        sf: 0,
        tb: 1,
        sb: 0,
        cs: 0,
        r: 0,
      }),
    ).toBe("3打数1安打");
    expect(
      batterLine({
        playerId: "1",
        name: "A",
        order: 1,
        side: "first",
        ab: 4,
        h: 0,
        bb: 1,
        hbp: 0,
        sf: 0,
        tb: 0,
        sb: 0,
        cs: 0,
        r: 0,
      }),
    ).toBe("4打数0安打 四球1");
  });
});
