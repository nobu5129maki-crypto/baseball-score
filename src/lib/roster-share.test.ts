import { describe, expect, it } from "vitest";
import { decodeRoster, encodeRoster } from "./roster-share";

describe("roster share", () => {
  it("コードの往復で名前と背番号が残る", () => {
    const code = encodeRoster("ひまわり", [
      { name: "佐藤", number: "1" },
      { name: "鈴木", number: "8" },
    ]);
    const pack = decodeRoster(code);
    expect(pack?.name).toBe("ひまわり");
    expect(pack?.players[1]).toEqual({ name: "鈴木", number: "8" });
  });
});
