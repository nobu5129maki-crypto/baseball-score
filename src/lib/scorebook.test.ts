import { describe, expect, it } from "vitest";
import { commitEnd, commitPinchHitter, commitPlay, commitSteal, commitSub, reduceGame } from "./engine";
import { buildScorebook, displayInnings, lastPlayedInning } from "./scorebook";
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
    expect(book.first.orders[0].innings[0].find((m) => m.label === "左安")?.hit).toBe(true);
    expect(book.innings).toBe(9);
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
    expect(book.first.orders[0].innings[0].find((m) => m.label === "三振")?.hit).toBeUndefined();
  });

  it("同じ選手の守備位置変更は名前を増やさない", () => {
    const game = commitSub(makeGame(), "first", 1, "A1", "A1", "LF");
    const row = buildScorebook(game).first.orders[0];
    expect(row.players).toHaveLength(1);
    expect(row.players[0].position).toBe("LF");
  });
});

function strikeouts(game: Game, n: number): Game {
  let next = game;
  for (let i = 0; i < n; i++) next = commitPlay(next, "strikeout");
  return next;
}

describe("displayInnings", () => {
  it("通常は9回まで表示する", () => {
    expect(displayInnings(makeGame())).toBe(9);
    expect(buildScorebook(makeGame()).innings).toBe(9);
    expect(lastPlayedInning(makeGame())).toBe(0);
  });

  it("規定回で終わっても9回列のままにする", () => {
    const game = commitEnd(strikeouts(makeGame(), 42));
    expect(reduceGame(game).inning).toBeGreaterThan(7);
    expect(lastPlayedInning(game)).toBe(7);
    expect(displayInnings(game)).toBe(9);
    expect(buildScorebook(game).innings).toBe(9);
  });

  it("9回終了後は延長していないので9回のまま", () => {
    const nine = { ...makeGame(), scheduledInnings: 9 };
    const game = commitEnd(strikeouts(nine, 54));
    expect(reduceGame(game).inning).toBe(10);
    expect(lastPlayedInning(game)).toBe(9);
    expect(displayInnings(game)).toBe(9);
  });

  it("10回まで行ったら10回まで出す", () => {
    const nine = { ...makeGame(), scheduledInnings: 9 };
    const game = commitEnd(strikeouts(nine, 55));
    expect(lastPlayedInning(game)).toBe(10);
    expect(displayInnings(game)).toBe(10);
    expect(buildScorebook(game).innings).toBe(10);
  });

  it("12回まで行ったら12回まで出す", () => {
    const nine = { ...makeGame(), scheduledInnings: 9 };
    const game = commitEnd(strikeouts(nine, 67));
    expect(lastPlayedInning(game)).toBe(12);
    expect(displayInnings(game)).toBe(12);
    expect(buildScorebook(game).innings).toBe(12);
  });
});
