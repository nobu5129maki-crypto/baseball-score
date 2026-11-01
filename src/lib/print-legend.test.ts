import { describe, expect, it } from "vitest";
import { legendForMarks, legendForStatHeaders, tokensInMark } from "./print-legend";

describe("tokensInMark", () => {
  it("位置・結果・打球に分ける", () => {
    expect(tokensInMark("左安ゴ")).toEqual({ positions: ["左"], plays: ["安", "ゴ"] });
    expect(tokensInMark("中二飛")).toEqual({ positions: ["中"], plays: ["二", "飛"] });
    expect(tokensInMark("二安")).toEqual({ positions: ["二"], plays: ["安"] });
    expect(tokensInMark("死")).toEqual({ positions: [], plays: ["死"] });
    expect(tokensInMark("見三")).toEqual({ positions: [], plays: ["見三"] });
    expect(tokensInMark("牽制死")).toEqual({ positions: [], plays: ["牽制死"] });
    expect(tokensInMark("三振")).toEqual({ positions: [], plays: [] });
  });
});

describe("legendForMarks", () => {
  it("出た略語だけを、死球のように説明する", () => {
    const items = legendForMarks(["死", "左安ゴ"], { positions: ["投", "左"] });
    expect(items).toEqual([
      { mark: "投", meaning: "投手" },
      { mark: "左", meaning: "左翼" },
      { mark: "安", meaning: "安打" },
      { mark: "死", meaning: "死球" },
      { mark: "ゴ", meaning: "ゴロ" },
    ]);
  });

  it("二は守備と二塁打の両方に使われたら併記する", () => {
    const items = legendForMarks(["中二"], { positions: ["二"] });
    expect(items.find((item) => item.mark === "二")?.meaning).toBe("二塁／二塁打");
  });

  it("二安の二は二塁手で、二塁打にはしない", () => {
    const items = legendForMarks(["二安"]);
    expect(items.find((item) => item.mark === "二")?.meaning).toBe("二塁");
    expect(items.find((item) => item.mark === "安")?.meaning).toBe("安打");
  });

  it("出ていない略語は載せない", () => {
    const items = legendForMarks(["四"]);
    expect(items.map((item) => item.mark)).toEqual(["四"]);
    expect(items.some((item) => item.mark === "死")).toBe(false);
  });

  it("サヨナラと攻撃なしのXを分け、セーブと守備交代も出す", () => {
    const items = legendForMarks(["X", "2X"], { defensiveSub: true, save: true });
    expect(items).toEqual([
      { mark: "守", meaning: "守備交代" },
      { mark: "X", meaning: "この回は攻撃していない" },
      { mark: "S", meaning: "セーブ" },
      { mark: "2X", meaning: "2点でサヨナラ" },
    ]);
  });
});

describe("legendForStatHeaders", () => {
  it("成績表に出ている見出しだけ説明する", () => {
    const items = legendForStatHeaders(["選手", "打数", "OPS", "安打"]);
    expect(items.map((item) => item.mark)).toEqual(["打数", "OPS"]);
    expect(items.find((item) => item.mark === "OPS")?.meaning).toBe("出塁率＋長打率");
  });
});
