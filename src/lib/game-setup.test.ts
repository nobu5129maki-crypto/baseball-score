import { describe, expect, it } from "vitest";
import { applyGameSetup } from "./game-setup";
import type { Game, LineupSlot, Player } from "./types";

function slot(order: number, name: string, position: LineupSlot["position"]): LineupSlot {
  return { order, playerId: name, playerName: name, position };
}

function game(over: Partial<Game> = {}): Game {
  return {
    id: "g1",
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "太陽",
    tournament: "春季",
    venue: "市民球場",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-10-24",
    status: "lineup",
    firstLineup: [slot(1, "相手1", "P"), slot(2, "相手2", "C")],
    secondLineup: [slot(1, "佐藤", "P"), slot(2, "鈴木", "C")],
    events: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

const base = {
  opponentName: "太陽",
  tournament: "春季",
  venue: "市民球場",
  date: "2026-10-24",
  mySide: "second" as const,
  useDh: false,
  scheduledInnings: 7,
};

describe("applyGameSetup", () => {
  it("日付・相手・大会・場所・イニングだけ変え、打順の選手は残す", () => {
    const next = applyGameSetup(game(), {
      ...base,
      opponentName: "北斗",
      tournament: "秋季",
      venue: "川のグラウンド",
      date: "2026-10-26",
      scheduledInnings: 9,
    });
    expect(next.date).toBe("2026-10-26");
    expect(next.opponentName).toBe("北斗");
    expect(next.tournament).toBe("秋季");
    expect(next.venue).toBe("川のグラウンド");
    expect(next.scheduledInnings).toBe(9);
    expect(next.secondLineup.map((s) => s.playerId)).toEqual(["佐藤", "鈴木"]);
    expect(next.firstLineup.map((s) => s.playerId)).toEqual(["相手1", "相手2"]);
  });

  it("先攻と後攻を入れ替えると、それぞれの打順も入れ替わる", () => {
    const next = applyGameSetup(game(), { ...base, mySide: "first" });
    expect(next.mySide).toBe("first");
    expect(next.firstLineup.map((s) => s.playerName)).toEqual(["佐藤", "鈴木"]);
    expect(next.secondLineup.map((s) => s.playerName)).toEqual(["相手1", "相手2"]);
  });

  it("空にした大会名と場所は消す", () => {
    const next = applyGameSetup(game(), { ...base, tournament: "  ", venue: "" });
    expect(next.tournament).toBeUndefined();
    expect(next.venue).toBeUndefined();
  });

  it("DH制にすると投手を打順外へ出し、空き選手を指名打者にする", () => {
    const bench: Player[] = [
      { id: "佐藤", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 },
      { id: "鈴木", teamId: "t1", name: "鈴木", number: "2", createdAt: 1 },
      { id: "加藤", teamId: "t1", name: "加藤", number: "10", createdAt: 1 },
    ];
    const next = applyGameSetup(game(), { ...base, useDh: true }, bench);
    expect(next.useDh).toBe(true);
    expect(next.secondPitcher).toMatchObject({ playerId: "佐藤", playerName: "佐藤" });
    expect(next.secondLineup[0]).toMatchObject({ playerId: "加藤", position: "DH" });
    expect(next.firstPitcher).toMatchObject({ playerId: "相手1" });
    expect(next.firstLineup[0]).toMatchObject({ playerName: "指名打者", position: "DH" });
  });

  it("DH制をやめると投手が打順に戻る", () => {
    const withDh = applyGameSetup(game(), { ...base, useDh: true });
    const next = applyGameSetup(withDh, { ...base, useDh: false });
    expect(next.useDh).toBeUndefined();
    expect(next.firstPitcher).toBeUndefined();
    expect(next.secondLineup[0]).toMatchObject({ playerId: "佐藤", position: "P" });
    expect(next.firstLineup[0]).toMatchObject({ playerId: "相手1", position: "P" });
  });

  it("得点で交代する点数を保存し、使わないときは消す", () => {
    const on = applyGameSetup(game(), { ...base, runChangeAt: 5 });
    expect(on.runChangeAt).toBe(5);
    const off = applyGameSetup(on, { ...base, runChangeAt: 0 });
    expect(off.runChangeAt).toBeUndefined();
    const invalid = applyGameSetup(on, { ...base, runChangeAt: 99 });
    expect(invalid.runChangeAt).toBeUndefined();
  });

  it("試合開始後は条件を変えない", () => {
    const started = game({ status: "in_progress" });
    const next = applyGameSetup(started, { ...base, date: "2026-11-01", mySide: "first" });
    expect(next).toBe(started);
  });
});
