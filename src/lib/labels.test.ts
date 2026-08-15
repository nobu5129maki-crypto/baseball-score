import { describe, expect, it } from "vitest";
import { needsField, playLabel } from "./labels";

describe("playLabel", () => {
  it("方向なしはスコアブックの略記にする", () => {
    expect(playLabel("single")).toBe("安");
    expect(playLabel("groundout")).toBe("ゴ");
    expect(playLabel("dropped_third")).toBe("振逃");
    expect(playLabel("homerun")).toBe("本");
  });

  it("方向付きは左安・遊ゴ・左本と書く", () => {
    expect(playLabel("single", "LF")).toBe("左安");
    expect(playLabel("groundout", "SS")).toBe("遊ゴ");
    expect(playLabel("homerun", "CF")).toBe("中本");
  });
});

describe("needsField", () => {
  it("本塁打も方向が必要", () => {
    expect(needsField("homerun")).toBe(true);
    expect(needsField("strikeout")).toBe(false);
  });
});
