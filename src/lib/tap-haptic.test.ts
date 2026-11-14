import { describe, expect, it } from "vitest";
import { TAP_VIBRATION_MS, isTapControl } from "./tap-haptic";

describe("isTapControl", () => {
  it("ボタンとリンクは振動の対象", () => {
    expect(isTapControl({ disabled: false })).toBe(true);
    expect(TAP_VIBRATION_MS).toBeLessThan(50);
  });

  it("押せないボタンは振動しない", () => {
    expect(isTapControl(null)).toBe(false);
    expect(isTapControl({ disabled: true })).toBe(false);
    expect(isTapControl({ getAttribute: (name) => (name === "aria-disabled" ? "true" : null) })).toBe(false);
  });
});
