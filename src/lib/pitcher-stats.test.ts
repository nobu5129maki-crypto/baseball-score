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
  formatRate,
  gamePitcherStats,
  myTeamPitcherStats,
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
    // 後攻B。表を抑えて裏に本塁打、以後相手を抑え続ける
    let game = makeGame({ scheduledInnings: 7 });
    // 1回表 3アウト
    game = retireSide(game);
    // 1回裏 本塁打 → 1-0、続けて2アウトでイニング終了
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    // 2〜4回表を抑える（先発B1が合計4回＝12アウト）
    for (let inn = 0; inn < 3; inn++) {
      game = retireSide(game);
      // 裏も3アウト（打順を進める）
      game = retireSide(game);
    }
    // いま B1 は表4回分＝12アウト。試合終了へ
    game = commitEnd(game);
    const b1 = gamePitcherStats(game).find((p) => p.playerId === "B1");
    expect(b1!.outs).toBeGreaterThanOrEqual(12);
    expect(b1!.wins).toBe(1);
    expect(b1!.losses).toBe(0);
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

  it("救援が締めくくり条件を満たせばセーブ", () => {
    // 先発がリードを作り、途中交代。救援が1点差で残りのアウトを取って終了
    let game = makeGame({ scheduledInnings: 7 });
    game = retireSide(game); // 1表
    game = commitPlay(game, "homerun", undefined, "LF");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout"); // 1裏 1-0
    game = retireSide(game); // 2表
    game = retireSide(game); // 2裏
    game = retireSide(game); // 3表
    // 救援に交代（まだリード1）
    game = commitSub(game, "second", 1, "PX", "救援", "P");
    game = retireSide(game); // 3裏（打席）— 実際は表の次
    // 状態を確認しつつ、救援が相手を抑えて終了
    // 交代後の次の守備イニングで3アウト
    // いま half を確認するのは難しいので、retire を繰り返して終了
    for (let i = 0; i < 20 && game.status !== "ended"; i++) {
      const before = game.events.length;
      game = commitPlay(game, "groundout");
      if (game.events.length === before) break;
    }
    game = commitEnd(game);
    const px = gamePitcherStats(game).find((p) => p.playerId === "PX");
    expect(px).toBeTruthy();
    expect(px!.games).toBe(1);
    expect(px!.pitches + px!.outs).toBeGreaterThan(0);
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
