/**
 * 指でボタンを離したときの短い振動。
 * Android の Chrome は、指の pointerdown では「操作した」と認めず振動を捨てる。
 * 指やペンは pointerup、マウスは pointerdown で頼む。
 */
export const TAP_VIBRATION_MS = 60;

export function shouldBuzzOnPointer(
  type: "pointerdown" | "pointerup",
  pointerType: string,
): boolean {
  if (type === "pointerdown") return pointerType === "mouse";
  return pointerType !== "mouse";
}

export function isTapControl(
  control: {
    disabled?: boolean;
    getAttribute?: (name: string) => string | null;
  } | null,
): boolean {
  if (!control) return false;
  if (control.disabled) return false;
  if (control.getAttribute?.("aria-disabled") === "true") return false;
  return true;
}

export function buzzTap(): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(TAP_VIBRATION_MS);
  } catch {
    /* 振動できない端末では記録の操作を止めない */
  }
}
