import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryById } from "./glossary";
import { needsField } from "./labels";
import {
  benchAdvanceNote,
  deadBallAdvanceNote,
  DROPPED_THIRD,
  FIELD_RESULTS,
  PLAY_RULES,
  playAwardsRbi,
  playBlockedReason,
  playHitValue,
  playIsAtBat,
  inferredBattedBall,
} from "./rules";
import type { GameState, PlayResult } from "./types";

describe("PLAY_RULES", () => {
  it("打球方向が必要なプレーはFIELD_RESULTSと一致する", () => {
    const fromRules = (Object.keys(PLAY_RULES) as PlayResult[]).filter((result) => PLAY_RULES[result].needsField);
    expect(FIELD_RESULTS).toEqual(fromRules);
    expect(needsField("homerun")).toBe(true);
    expect(needsField("walk")).toBe(false);
  });

  it("ルールを直すとボタン抑制も用語解説も同じ条件になる", () => {
    const empty: Pick<GameState, "outs" | "bases"> = { outs: 0, bases: [null, null, null] };
    const twoOuts: Pick<GameState, "outs" | "bases"> = {
      outs: 2,
      bases: [null, null, { playerId: "r", playerName: "走", battingOrder: 1 }],
    };
    expect(playBlockedReason("sac_fly", empty)).toMatch(/3塁/);
    expect(playBlockedReason("sac_fly", twoOuts)).toMatch(/2アウト/);
    expect(glossaryById("sf")?.plain).toContain("2アウトでは犠飛になりません");
    expect(playBlockedReason("sac_bunt", empty)).toMatch(/走者/);
    expect(glossaryById("sh")?.plain).toContain("2アウトでは犠打になりません");
  });

  it("振り逃げの可否と画面の説明は同じルールから出る", () => {
    const emptyFirst: Pick<GameState, "outs" | "bases"> = { outs: 0, bases: [null, null, null] };
    const manOnFirst: Pick<GameState, "outs" | "bases"> = {
      outs: 0,
      bases: [{ playerId: "r", playerName: "走", battingOrder: 1 }, null, null],
    };
    const twoOutFirst: Pick<GameState, "outs" | "bases"> = {
      outs: 2,
      bases: [{ playerId: "r", playerName: "走", battingOrder: 1 }, null, null],
    };
    expect(DROPPED_THIRD.allowed(emptyFirst)).toBe(true);
    expect(DROPPED_THIRD.allowed(manOnFirst)).toBe(false);
    expect(DROPPED_THIRD.allowed(twoOutFirst)).toBe(true);
    expect(glossaryById("ks")?.plain).toContain("1塁に走者がいないとき");
    expect(DROPPED_THIRD.blockedHint).toContain("振り逃げはできません");
  });

  it("打数・安打・打点の数え方もルール表に従う", () => {
    expect(playIsAtBat("walk")).toBe(false);
    expect(playIsAtBat("catcher_interference")).toBe(false);
    expect(playIsAtBat("offensive_interference")).toBe(true);
    expect(playAwardsRbi("catcher_interference")).toBe(true);
    expect(playAwardsRbi("offensive_interference")).toBe(false);
    expect(glossaryById("oi")?.plain).toContain("走者当たり");
    expect(glossaryById("oi")?.plain).toContain("安打や失策にはしません");
    expect(glossaryById("ci")?.when).toContain("打撃妨害");
    expect(glossaryById("ci")?.when).not.toContain("その他");
    expect(glossaryById("rh")?.plain).toContain("守備妨害");
    expect(playIsAtBat("strikeout_looking")).toBe(true);
    expect(playIsAtBat("strikeout_swinging")).toBe(true);
    expect(playIsAtBat("single")).toBe(true);
    expect(playHitValue("homerun")).toBe(4);
    expect(playHitValue("runner_hit")).toBe(1);
    expect(playAwardsRbi("gidp")).toBe(false);
    expect(playAwardsRbi("error")).toBe(false);
    expect(glossaryById("dead")?.plain).toContain("それぞれ1つ進みます");
    expect(
      deadBallAdvanceNote([
        { playerId: "r", playerName: "走", battingOrder: 1 },
        null,
        null,
      ]),
    ).toContain("1塁の走者は2塁へ進みます");
    expect(
      benchAdvanceNote([
        { playerId: "r1", playerName: "一", battingOrder: 1 },
        null,
        { playerId: "r3", playerName: "三", battingOrder: 3 },
      ]),
    ).toContain("1塁の走者は2塁へ進みます");
    expect(
      benchAdvanceNote([
        { playerId: "r1", playerName: "一", battingOrder: 1 },
        null,
        { playerId: "r3", playerName: "三", battingOrder: 3 },
      ]),
    ).toContain("3塁の走者はホームへ進みます");
    expect(playAwardsRbi("sac_fly")).toBe(true);
  });

  it("ヒットに付けた当たり方を優先し、付けてない本塁打はフライとみなす", () => {
    expect(inferredBattedBall("single")).toBeUndefined();
    expect(inferredBattedBall("single", "ground")).toBe("ground");
    expect(inferredBattedBall("homerun")).toBe("fly");
    expect(inferredBattedBall("homerun", "line")).toBe("line");
    expect(inferredBattedBall("groundout")).toBe("ground");
    expect(inferredBattedBall("lineout")).toBe("line");
  });

  it("採点ルールの用語はこれのこと？に載る", () => {
    for (const id of ["fc", "sh", "sf", "ks", "kl", "ksw", "rh", "ci", "oi", "bk", "dead", "rbi", "slg", "ops", "ab"]) {
      expect(GLOSSARY.some((term) => term.id === id)).toBe(true);
    }
  });
});
