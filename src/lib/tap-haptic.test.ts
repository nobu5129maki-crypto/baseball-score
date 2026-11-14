import { describe, expect, it } from "vitest";
import { TAP_VIBRATION_MS, isTapControl, shouldBuzzOnPointer } from "./tap-haptic";

describe("shouldBuzzOnPointer", () => {
  it("指で押した瞬間には振動を頼まず、離したときに頼む", () => {
    expect(shouldBuzzOnPointer("pointerdown", "touch")).toBe(false);
    expect(shouldBuzzOnPointer("pointerup", "touch")).toBe(true);
    expect(shouldBuzzOnPointer("pointerup", "pen")).toBe(true);
  });

  it("マウスは押した瞬間に頼む", () => {
    expect(shouldBuzzOnPointer("pointerdown", "mouse")).toBe(true);
    expect(shouldBuzzOnPointer("pointerup", "mouse")).toBe(false);
  });

  it("一回の振動は短い", () => {
    expect(TAP_VIBRATION_MS).toBeGreaterThanOrEqual(40);
    expect(TAP_VIBRATION_MS).toBeLessThanOrEqual(80);
  });
});

describe("isTapControl", () => {
  it("押せないボタンは振動しない", () => {
    expect(isTapControl(null)).toBe(false);
    expect(isTapControl({ disabled: true })).toBe(false);
    expect(isTapControl({ getAttribute: (name) => (name === "aria-disabled" ? "true" : null) })).toBe(false);
    expect(isTapControl({ disabled: false })).toBe(true);
  });
});
