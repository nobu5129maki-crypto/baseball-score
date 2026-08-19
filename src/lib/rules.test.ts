import { describe, expect, it } from "vitest";
import { GLOSSARY, glossaryById } from "./glossary";
import { needsField } from "./labels";
import {
  DROPPED_THIRD,
  FIELD_RESULTS,
  PLAY_RULES,
  playAwardsRbi,
  playBlockedReason,
  playHitValue,
  playIsAtBat,
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
    expect(playIsAtBat("single")).toBe(true);
    expect(playHitValue("homerun")).toBe(4);
    expect(playHitValue("runner_hit")).toBe(1);
    expect(playAwardsRbi("gidp")).toBe(false);
    expect(playAwardsRbi("error")).toBe(false);
    expect(playAwardsRbi("sac_fly")).toBe(true);
  });

  it("採点ルールの用語はこれのこと？に載る", () => {
    for (const id of ["fc", "sh", "sf", "ks", "rh", "bk", "rbi", "slg", "ops", "ab"]) {
      expect(GLOSSARY.some((term) => term.id === id)).toBe(true);
    }
  });
});
