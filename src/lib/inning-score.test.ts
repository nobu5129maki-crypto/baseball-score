import { describe, expect, it } from "vitest";
import { commitEnd, commitPlay, reduceGame } from "./engine";
import { inningScoreCells } from "./inning-score";
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

function outs(game: Game, n: number): Game {
  let next = game;
  for (let i = 0; i < n; i++) next = commitPlay(next, "groundout");
  return next;
}

function sliceLine(scores: number[], state: ReturnType<typeof reduceGame>, side: "first" | "second", cols = 4) {
  return inningScoreCells(scores, cols, state, side);
}

describe("inningScoreCells", () => {
  it("1回表の開始直後は先攻1回だけ0、後攻1回は未開始", () => {
    const state = reduceGame(makeGame());
    expect(sliceLine(state.scores.first, state, "first")).toEqual([0, null, null, null]);
    expect(sliceLine(state.scores.second, state, "second")).toEqual([null, null, null, null]);
  });

  it("2回表のあいだは後攻2回を未開始のままにする", () => {
    const game = outs(makeGame(), 6);
    const state = reduceGame(game);
    expect(state.inning).toBe(2);
    expect(state.half).toBe("top");
    expect(sliceLine(state.scores.first, state, "first")).toEqual([0, 0, null, null]);
    expect(sliceLine(state.scores.second, state, "second")).toEqual([0, null, null, null]);
  });

  it("2回表で試合終了したら後攻2回は点ではなく未開始", () => {
    const game = commitEnd(outs(makeGame(), 6));
    const state = reduceGame(game);
    expect(state.ended).toBe(true);
    expect(state.half).toBe("top");
    expect(state.inning).toBe(2);
    expect(sliceLine(state.scores.first, state, "first")).toEqual([0, 0, null, null]);
    expect(sliceLine(state.scores.second, state, "second")).toEqual([0, null, null, null]);
  });

  it("2回裏が始まったら後攻2回は0になる", () => {
    const game = outs(makeGame(), 9);
    const state = reduceGame(game);
    expect(state.inning).toBe(2);
    expect(state.half).toBe("bottom");
    expect(sliceLine(state.scores.first, state, "first")).toEqual([0, 0, null, null]);
    expect(sliceLine(state.scores.second, state, "second")).toEqual([0, 0, null, null]);
  });

  it("規定回表のあと裏を省略したら後攻はその回をXにする", () => {
    let game: Game = { ...makeGame(), scheduledInnings: 2 };
    game = outs(game, 3);
    game = commitPlay(game, "homerun");
    game = outs(game, 6);
    const state = reduceGame(game);
    expect(state.ended).toBe(true);
    expect(state.bottomUnplayed).toBe(true);
    expect(state.inning).toBe(2);
    expect(sliceLine(state.scores.first, state, "first")).toEqual([0, 0, null, null]);
    expect(sliceLine(state.scores.second, state, "second")).toEqual([1, "X", null, null]);
  });
});
