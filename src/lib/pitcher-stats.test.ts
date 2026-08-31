import { describe, expect, it } from "vitest";
import {
  commitEnd,
  commitPlay,
  commitPitch,
  commitSub,
} from "./engine";
import {
  formatEra,
  formatInnings,
  formatPitcherGameLine,
  formatRate,
  gamePitcherStats,
  myTeamPitcherStats,
  pitcherDecisionMark,
  starterWinOuts,
} from "./pitcher-stats";
import type { Game, LineupSlot, Position } from "./types";

function slot(order: number, prefix: string, position: Position): LineupSlot {
  return { order, playerId: `${prefix}${order}`, playerName: `${prefix}${order}`, position };
}

function lineup(prefix: string): LineupSlot[] {
  const positions: Position[] = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
  return positions.map((position, i) => slot(i + 1, prefix, position));
}

function makeGame(over: Partial<Game> = {}): Game {
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
    ...over,
  };
}

/** 守備側が3アウト取る */
function retireSide(game: Game): Game {
  let g = game;
  for (let i = 0; i < 3; i++) g = commitPlay(g, "groundout");
  return g;
}

describe("formatInnings / formatEra / formatRate", () => {
  it("アウトを日本式の回に直す", () => {
    expect(formatInnings(0)).toBe("0");
    expect(formatInnings(1)).toBe("0.1");
    expect(formatInnings(2)).toBe("0.2");
    expect(formatInnings(3)).toBe("1");
    expect(formatInnings(16)).toBe("5.1");
  });

  it("防御率は自責×27÷アウト", () => {
    expect(formatEra(1, 27)).toBe("1.00");
    expect(formatEra(0, 9)).toBe("0.00");
    expect(formatEra(2, 0)).toBe("-");
  });

  it("割合は百分率", () => {
    expect(formatRate(1, 2)).toBe("50.0%");
    expect(formatRate(0, 0)).toBe("-");
  });
});

describe("pitcherDecisionMark / formatPitcherGameLine", () => {
  it("勝敗・セーブと回数・投球数を書く", () => {
    expect(pitcherDecisionMark({ wins: 1, losses: 0, saves: 0 })).toBe("勝");
    expect(pitcherDecisionMark({ wins: 0, losses: 1, saves: 0 })).toBe("敗");
    expect(pitcherDecisionMark({ wins: 0, losses: 0, saves: 1 })).toBe("S");
    expect(pitcherDecisionMark({ wins: 0, losses: 0, saves: 0 })).toBe("");
    expect(formatPitcherGameLine({ wins: 1, losses: 0, saves: 0, outs: 12, pitches: 58 })).toBe("勝 4回 58球");
    expect(formatPitcherGameLine({ wins: 0, losses: 1, saves: 0, outs: 6, pitches: 30 })).toBe("敗 2回 30球");
    expect(formatPitcherGameLine({ wins: 0, losses: 0, saves: 1, outs: 3, pitches: 12 })).toBe("S 1回 12球");
    expect(formatPitcherGameLine({ wins: 0, losses: 0, saves: 0, outs: 1, pitches: 8 })).toBe("0.1回 8球");
  });
});

describe("starterWinOuts", () => {
  it("7回制は4回、9回制は5回分のアウト", () => {
    expect(starterWinOuts(7)).toBe(12);
    expect(starterWinOuts(9)).toBe(15);
  });
});

describe("gamePitcherStats", () => {
  it("投球数・三振・四球・被安打を数える", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "ball");
    game = commitPlay(game, "strikeout");
    game = commitPlay(game, "walk");
    game = commitPlay(game, "single", undefined, "CF");
    const mine = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(mine).toMatchObject({
      so: 1,
      bb: 1,
      hits: 1,
      pitches: 5,
      whiffs: 1,
    });
    expect(mine!.strikes).toBeGreaterThanOrEqual(3);
  });

  it("アウトを投球回に積む", () => {
    let game = makeGame();
    game = retireSide(game);
    const mine = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(mine?.outs).toBe(3);
    expect(formatInnings(mine!.outs)).toBe("1");
  });

  it("ゴロとフライを分ける", () => {
    let game = makeGame();
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "flyout", undefined, "CF");
    game = commitPlay(game, "lineout", undefined, "SS");
    const mine = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(mine).toMatchObject({ groundBalls: 1, flyBalls: 1, lineBalls: 1 });
  });

  it("エラーで出た走者の得点は自責にしない", () => {
    let game = makeGame();
    game = commitPlay(game, "error", undefined, "SS");
    game = commitPlay(game, "single", undefined, "CF"); // 走者生還想定は proposeMoves に依存
    // 明示的に得点させる: エラー走者をホームへ
    // single のデフォルトで1塁走者が進む。確実にするため homerun
    game = makeGame();
    game = commitPlay(game, "error", undefined, "SS");
    game = commitPlay(game, "homerun", undefined, "LF");
    const mine = gamePitcherStats(game).find((p) => p.playerId === "B1");
    // 本塁打の打者は自責、エラー走者は非自責 → 自責は1（打者分）以上だがエラー走者分は含まない
    expect(mine!.er).toBeLessThanOrEqual(1);
    expect(mine!.hits).toBe(1);
    expect(mine!.hr).toBe(1);
  });

  it("本塁打だけの自責は付く", () => {
    let game = makeGame();
    game = commitPlay(game, "homerun", undefined, "CF");
    const mine = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(mine).toMatchObject({ er: 1, hr: 1, hits: 1 });
  });

  it("先発が規定回を投げてリードを保てば勝利", () => {
    let game = makeGame({ scheduledInnings: 7 });
    game = retireSide(game);
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    for (let inn = 0; inn < 3; inn++) {
      game = retireSide(game);
      game = retireSide(game);
    }
    game = commitEnd(game);
    const b1 = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(b1!.outs).toBeGreaterThanOrEqual(12);
    expect(b1!.wins).toBe(1);
    expect(b1!.losses).toBe(0);
  });

  it("規定回未満でも救援がいなければ先発に勝利が残る", () => {
    let game = makeGame({ scheduledInnings: 7 });
    game = retireSide(game);
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitEnd(game);
    const b1 = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(b1!.outs).toBeLessThan(starterWinOuts(7));
    expect(b1!.wins).toBe(1);
  });

  it("リードを許した投手が敗戦になる", () => {
    // 先攻Aが本塁打、後攻が追いつけず終了 → B1（後攻投手）に敗戦
    let game = makeGame();
    game = commitPlay(game, "homerun", undefined, "LF");
    game = retireSide(game); // 残りアウト（本塁打後の打者から）
    // 実際 homerun 後は次打者。retireSide は3アウト取るのでイニングが変わる可能性
    // シンプルに: 表で本塁打→3アウト、裏も3アウト、を繰り返し、終了
    game = makeGame();
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout"); // 1回表終了 1-0
    game = retireSide(game); // 1回裏
    game = commitEnd(game);
    const b1 = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(b1!.losses).toBe(1);
    expect(b1!.wins).toBe(0);
  });

  it("救援が3回以上投げて締めくくればセーブ", () => {
    let game = makeGame({ scheduledInnings: 7 });
    game = retireSide(game);
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    for (let inn = 0; inn < 3; inn++) {
      game = retireSide(game);
      game = retireSide(game);
    }
    game = commitSub(game, "second", 1, "PX", "救援", "P");
    game = retireSide(game);
    game = retireSide(game);
    game = retireSide(game);
    game = retireSide(game);
    game = retireSide(game);
    game = commitEnd(game);
    const b1 = gamePitcherStats(game).find((p) => p.playerId === "B1");
    const px = gamePitcherStats(game).find((p) => p.playerId === "PX");
    expect(b1).toMatchObject({ wins: 1, saves: 0 });
    expect(px).toMatchObject({ wins: 0, saves: 1 });
    expect(px!.outs).toBeGreaterThanOrEqual(9);
    expect(formatPitcherGameLine(px!)).toMatch(/^S /);
  });

  it("投手交代後は成績が分かれる", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitSub(game, "second", 1, "PX", "新投手", "P");
    game = commitPitch(game, "ball");
    game = commitPlay(game, "strikeout");
    const rows = gamePitcherStats(game).filter((p) => p.side === "second");
    expect(rows.find((p) => p.playerId === "B1")?.pitches).toBe(1);
    expect(rows.find((p) => p.playerId === "PX")?.pitches).toBe(2);
    expect(rows.find((p) => p.playerId === "PX")?.so).toBe(1);
  });
});

describe("myTeamPitcherStats", () => {
  it("西暦ごとに合算する", () => {
    let g1 = makeGame({ id: "a", date: "2025-05-01", mySide: "second" });
    g1 = commitPlay(g1, "strikeout");
    g1 = commitEnd(g1);
    let g2 = makeGame({ id: "b", date: "2026-05-01", mySide: "second" });
    g2 = commitPlay(g2, "strikeout");
    g2 = commitEnd(g2);
    let g3 = makeGame({ id: "c", date: "2026-06-01", mySide: "second" });
    g3 = commitPlay(g3, "walk");
    g3 = commitEnd(g3);
    const rows = myTeamPitcherStats([g1, g2, g3]);
    const y2026 = rows.find((p) => p.playerId === "B1" && p.year === 2026);
    const y2025 = rows.find((p) => p.playerId === "B1" && p.year === 2025);
    expect(y2025?.games).toBe(1);
    expect(y2025?.so).toBe(1);
    expect(y2026?.games).toBe(2);
    expect(y2026?.so).toBe(1);
    expect(y2026?.bb).toBe(1);
  });
});
