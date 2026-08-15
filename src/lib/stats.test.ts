import { describe, expect, it } from "vitest";
import { commitEnd, commitPinchHitter, commitPlay, commitPitch, commitSteal, commitSub } from "./engine";
import { atBatsThisGame, batterLine, formatObp, formatOps, myTeamPitchers, myTeamSeason, myTeamSlashes, plateAppearances, sumSlashes } from "./stats";
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
        sh: 0,
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
        sh: 0,
        tb: 0,
        sb: 0,
        cs: 0,
        r: 0,
      }),
    ).toBe("4打数0安打 四球1");
  });
});

describe("formatOps / myTeamSlashes", () => {
  function mine(): Game {
    return { ...makeGame(), mySide: "first" };
  }

  it("OPSは出塁率と長打率の合計", () => {
    expect(formatOps({ ab: 3, h: 1, bb: 0, hbp: 0, sf: 0, tb: 1 })).toBe(".667");
  });

  it("自チームだけ累積し相手は入れない", () => {
    const game = commitPlay(mine(), "single");
    const rows = myTeamSlashes([game]);
    expect(rows.every((p) => p.side === "first")).toBe(true);
    const a1 = rows.find((p) => p.playerId === "A1");
    expect(a1).toMatchObject({ ab: 1, h: 1 });
    expect(rows.some((p) => p.playerId.startsWith("B"))).toBe(false);
  });

  it("複数試合の打数安打盗塁を足す", () => {
    let g1 = commitPlay({ ...mine(), id: "g1" }, "single");
    g1 = commitSteal(g1, 1, 2);
    g1 = commitEnd(g1);
    const g2 = commitEnd(commitPlay({ ...mine(), id: "g2" }, "single"));
    const a1 = myTeamSlashes([g1, g2]).find((p) => p.playerId === "A1");
    expect(a1).toMatchObject({ ab: 2, h: 2, sb: 1 });
  });

  it("四球は打席に入り打数には入らない", () => {
    const game = commitPlay(mine(), "walk");
    const a1 = myTeamSlashes([game]).find((p) => p.playerId === "A1");
    expect(a1).toBeTruthy();
    expect(plateAppearances(a1!)).toBe(1);
    expect(a1!.ab).toBe(0);
    expect(formatObp(a1!)).toBe("1.000");
  });
});

describe("myTeamPitchers", () => {
  it("先発投手の投球数を数える", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "ball");
    game = commitPitch(game, "foul");
    const rows = myTeamPitchers(game);
    expect(rows).toEqual([{ playerId: "B1", name: "B1", pitches: 3 }]);
  });

  it("相手の投球は自チームに入れない", () => {
    let game: Game = { ...makeGame(), mySide: "first" };
    game = commitPitch(game, "strike");
    game = commitPitch(game, "strike");
    expect(myTeamPitchers(game)).toEqual([{ playerId: "A1", name: "A1", pitches: 0 }]);
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPlay(game, "groundout");
    game = commitPitch(game, "ball");
    game = commitPitch(game, "strike");
    expect(myTeamPitchers(game)).toEqual([{ playerId: "A1", name: "A1", pitches: 2 }]);
  });

  it("投手交代後は投手ごとに球数を分ける", () => {
    let game = makeGame();
    game = commitPitch(game, "strike");
    game = commitPitch(game, "ball");
    game = commitSub(game, "second", 1, "PX", "新投手", "P");
    game = commitPitch(game, "strike");
    expect(myTeamPitchers(game)).toEqual([
      { playerId: "B1", name: "B1", pitches: 2 },
      { playerId: "PX", name: "新投手", pitches: 1 },
    ]);
  });

  it("ヒットとアウトも投球数に入る", () => {
    let game = makeGame();
    game = commitPlay(game, "single");
    expect(myTeamPitchers(game)).toEqual([{ playerId: "B1", name: "B1", pitches: 1 }]);
    game = commitPlay(game, "groundout");
    expect(myTeamPitchers(game)[0]?.pitches).toBe(2);
  });
});

describe("myTeamSeason", () => {
  function mine(): Game {
    return { ...makeGame(), mySide: "first" };
  }

  it("終了試合の勝敗と個人合計をチーム成績にする", () => {
    let win = commitPlay({ ...mine(), id: "w" }, "homerun");
    win = commitEnd(win);
    let lose = commitPlay({ ...mine(), id: "l", mySide: "second" }, "homerun");
    lose = commitEnd(lose);
    const season = myTeamSeason([win, lose]);
    expect(season).toMatchObject({ played: 2, wins: 1, losses: 1, draws: 0 });
    expect(season.batting.h).toBe(1);
    expect(sumSlashes(myTeamSlashes([win, lose])).h).toBe(1);
  });
});
