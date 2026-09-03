import { describe, expect, it } from "vitest";

/** 変換中は親へ伝播しない */
export function shouldPropagateImeChange(isComposing: boolean): boolean {
  return !isComposing;
}

describe("IME name input commit", () => {
  it("変換中は親へ反映しない", () => {
    expect(shouldPropagateImeChange(true)).toBe(false);
  });

  it("変換確定後・通常入力は親へ反映する", () => {
    expect(shouldPropagateImeChange(false)).toBe(true);
  });
});
