import { describe, expect, it } from "vitest";
import {
  commitEnd,
  commitPb,
  commitPickoff,
  commitPinchHitter,
  commitPinchRunner,
  commitPitch,
  commitPlay,
  commitSteal,
  commitSub,
  commitWp,
  getBatter,
  previewAfterMoves,
  proposeMoves,
  proposeRunnerHit,
  reduceGame,
  undoAtBat,
  undoLast,
} from "./engine";
import type { Game, LineupSlot, Position } from "./types";

function slot(order: number, prefix: string, position: Position): LineupSlot {
  return {
    order,
    playerId: `${prefix}${order}`,
    playerName: `${prefix}${order}`,
    position,
  };
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

describe("らくスコア engine", () => {
  it("初期状態は1回表・無走者", () => {
    const state = reduceGame(makeGame());
    expect(state.inning).toBe(1);
    expect(state.half).toBe("top");
    expect(state.outs).toBe(0);
    expect(getBatter(state).playerName).toBe("A1");
    expect(state.scores.first).toHaveLength(12);
  });

  it("ボール4つで四球、打者が1塁", () => {
    let game = makeGame();
    game = commitPitch(game, "ball");
    game = commitPitch(game, "ball");
    game = commitPitch(game, "ball");
    game = commitPitch(game, "ball");
    const state = reduceGame(game);
    expect(state.bases[0]?.playerId).toBe("A1");
    expect(state.balls).toBe(0);
    expect(getBatter(state).playerId).toBe("A2");
    expect(game.events.some((e) => e.t === "play" && e.result === "walk")).toBe(true);
  });

  it("ストライク3つで三振、1アウト", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "strike");
    game = commitPitch(game, "strike");
    const state = reduceGame(game);
    expect(state.outs).toBe(1);
    expect(state.bases.every((b) => b === null)).toBe(true);
    expect(getBatter(state).playerId).toBe("A2");
  });

  it("2ストライク後のファウルはストライクが増えない", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "strike");
    game = commitPitch(game, "foul");
    const state = reduceGame(game);
    expect(state.strikes).toBe(2);
    expect(state.outs).toBe(0);
    expect(state.pitchCountAtBat).toBe(3);
  });

  it("単打で打者が1塁", () => {
    const game = commitPlay(makeGame(), "single");
    const state = reduceGame(game);
    expect(state.bases[0]?.playerId).toBe("A1");
    expect(state.hits.first).toBe(1);
  });

  it("1塁走者ありの単打で1・2塁", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitPlay(game, "single");
    const state = reduceGame(game);
    expect(state.bases[0]?.playerId).toBe("A2");
    expect(state.bases[1]?.playerId).toBe("A1");
  });

  it("満塁本塁打は4点", () => {
    let game = makeGame();
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    game = commitPlay(game, "homerun");
    const state = reduceGame(game);
    expect(state.scores.first[0]).toBe(4);
    expect(state.bases.every((b) => b === null)).toBe(true);
    expect(state.hits.first).toBe(4);
  });

  it("満塁四球は押し出し1点で満塁のまま", () => {
    let game = makeGame();
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    game = commitPlay(game, "walk");
    const state = reduceGame(game);
    expect(state.scores.first[0]).toBe(1);
    expect(state.bases[0]?.playerId).toBe("A4");
    expect(state.bases[1]?.playerId).toBe("A3");
    expect(state.bases[2]?.playerId).toBe("A2");
  });

  it("3アウトで裏に交代し走者消滅", () => {
    let game = makeGame();
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    const state = reduceGame(game);
    expect(state.half).toBe("bottom");
    expect(state.inning).toBe(1);
    expect(state.outs).toBe(0);
    expect(state.bases.every((b) => b === null)).toBe(true);
    expect(getBatter(state).playerId).toBe("B1");
    expect(state.lineupIndex.first).toBe(3);
  });

  it("裏の3アウトで2回表へ", () => {
    let game = makeGame();
    for (let i = 0; i < 6; i++) game = commitPlay(game, "groundout");
    const state = reduceGame(game);
    expect(state.inning).toBe(2);
    expect(state.half).toBe("top");
    expect(getBatter(state).playerId).toBe("A4");
  });

  it("Undo 1球でカウントが戻る", () => {
    let game = commitPitch(makeGame(), "ball");
    game = commitPitch(game, "strike");
    game = { ...game, events: undoLast(game.events) };
    const state = reduceGame(game);
    expect(state.balls).toBe(1);
    expect(state.strikes).toBe(0);
  });

  it("Undo 打席で四球ごと消える", () => {
    let game = makeGame();
    game = commitPitch(game, "ball");
    game = commitPlay(game, "walk");
    game = { ...game, events: undoAtBat(game.events) };
    const state = reduceGame(game);
    expect(state.bases[0]).toBeNull();
    expect(getBatter(state).playerId).toBe("A1");
  });

  it("盗塁で1塁から2塁へ", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitSteal(game, 1, 2);
    const state = reduceGame(game);
    expect(state.bases[0]).toBeNull();
    expect(state.bases[1]?.playerId).toBe("A1");
    expect(getBatter(state).playerId).toBe("A2");
  });

  it("暴投で走者が進塁し打者は変わらない", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitWp(game);
    const state = reduceGame(game);
    expect(state.bases[1]?.playerId).toBe("A1");
    expect(getBatter(state).playerId).toBe("A2");
    expect(state.hits.first).toBe(1);
  });

  it("捕逸も同様に進塁", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitPb(game);
    expect(reduceGame(game).bases[1]?.playerId).toBe("A1");
  });

  it("エラーは安打にせず失策が守備側に付く", () => {
    const game = commitPlay(makeGame(), "error");
    const state = reduceGame(game);
    expect(state.hits.first).toBe(0);
    expect(state.errors.second).toBe(1);
    expect(state.bases[0]?.playerId).toBe("A1");
  });

  it("交代すると次打者名が変わる", () => {
    let game = makeGame();
    game = commitSub(game, "first", 1, "X9", "控え太郎", "LF");
    const state = reduceGame(game);
    expect(getBatter(state).playerName).toBe("控え太郎");
  });

  it("試合終了フラグが立つ", () => {
    const game = commitEnd(makeGame());
    expect(game.status).toBe("ended");
    expect(reduceGame(game).ended).toBe(true);
  });

  it("満塁四球の提案は押し出しを含む", () => {
    let game = makeGame();
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    game = commitPlay(game, "single");
    const state = reduceGame(game);
    const moves = proposeMoves("walk", state, getBatter(state));
    expect(moves.some((m) => m.to === 4)).toBe(true);
  });

  it("二塁走者はツーベースでも三塁で止められる", () => {
    let game = commitPlay(makeGame(), "double");
    const r2 = reduceGame(game).bases[1];
    expect(r2?.playerId).toBe("A1");
    const before = reduceGame(game);
    const batter = getBatter(before);
    const custom = [
      { playerId: batter.playerId, from: 0 as const, to: 2 as const },
      { playerId: r2!.playerId, from: 2 as const, to: 3 as const },
    ];
    const preview = previewAfterMoves(before, custom, batter);
    expect(preview.bases[1]?.playerId).toBe(batter.playerId);
    expect(preview.bases[2]?.playerId).toBe("A1");
    expect(preview.scored).toHaveLength(0);
    game = commitPlay(game, "double", custom);
    const state = reduceGame(game);
    expect(state.bases[1]?.playerId).toBe(batter.playerId);
    expect(state.bases[2]?.playerId).toBe("A1");
    expect(state.scores.first[0]).toBe(0);
  });

  it("振り逃げは打者が1塁に生きる", () => {
    const state = reduceGame(commitPlay(makeGame(), "dropped_third"));
    expect(state.outs).toBe(0);
    expect(state.bases[0]?.playerId).toBe("A1");
  });

  it("牽制アウトで走者が消える", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitPickoff(game, 1);
    const state = reduceGame(game);
    expect(state.outs).toBe(1);
    expect(state.bases[0]).toBeNull();
    expect(getBatter(state).playerId).toBe("A2");
  });

  it("一塁に代走を出せる", () => {
    let game = commitPlay(makeGame(), "single");
    game = commitPinchRunner(game, 1, "PR1", "代走太", "LF");
    const state = reduceGame(game);
    expect(state.bases[0]?.playerName).toBe("代走太");
    expect(state.firstLineup[0].playerName).toBe("代走太");
  });

  it("代打すると今の打者が交代しカウントは残る", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "ball");
    game = commitPinchHitter(game, "PH1", "代打太");
    const state = reduceGame(game);
    expect(getBatter(state).playerId).toBe("PH1");
    expect(getBatter(state).playerName).toBe("代打太");
    expect(getBatter(state).order).toBe(1);
    expect(getBatter(state).position).toBe("P");
    expect(state.strikes).toBe(1);
    expect(state.balls).toBe(1);
  });

  it("打球方向付きのヒットを記録できる", () => {
    const game = commitPlay(makeGame(), "single", undefined, "LF");
    const play = game.events.find((e) => e.t === "play");
    expect(play && play.t === "play" && play.field).toBe("LF");
  });

  it("投手交代で今の投手の投球数はリセットされる", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "ball");
    expect(reduceGame(game).pitchesThrown.second).toBe(2);
    game = commitSub(game, "second", 1, "PX", "新投手", "P");
    expect(reduceGame(game).pitchesThrown.second).toBe(0);
    game = commitPitch(game, "strike");
    expect(reduceGame(game).pitchesThrown.second).toBe(1);
  });

  it("打球が走者に当たるとその走者はアウト、打者は1塁", () => {
    let game = commitPlay(makeGame(), "single");
    const before = reduceGame(game);
    const batter = getBatter(before);
    game = commitPlay(game, "runner_hit", proposeRunnerHit(before, batter, 1));
    const state = reduceGame(game);
    expect(state.outs).toBe(1);
    expect(state.bases[0]?.playerId).toBe(batter.playerId);
    expect(state.hits.first).toBe(1);
    expect(getBatter(state).playerId).toBe("A3");
  });
});
