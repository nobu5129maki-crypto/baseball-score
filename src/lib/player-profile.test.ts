import { describe, expect, it } from "vitest";
import { ageLabel, parseAgeInput, playerProfileLabel, throwsBatsLabel } from "./player-profile";

describe("player profile labels", () => {
  it("右投右打と学年を並べる", () => {
    expect(
      playerProfileLabel({ throws: "right", bats: "right", ageKind: "grade", grade: "小6" }),
    ).toBe("右投右打 · 小6");
  });

  it("左投げと年齢だけでも出せる", () => {
    expect(throwsBatsLabel({ throws: "left" })).toBe("左投げ");
    expect(ageLabel({ ageKind: "age", age: 12 })).toBe("12歳");
  });

  it("両打ちを短く出す", () => {
    expect(throwsBatsLabel({ throws: "right", bats: "switch" })).toBe("右投両打");
  });

  it("年齢は1から99だけ受け付ける", () => {
    expect(parseAgeInput("12")).toBe(12);
    expect(parseAgeInput("0")).toBeUndefined();
    expect(parseAgeInput("abc")).toBeUndefined();
  });
});
