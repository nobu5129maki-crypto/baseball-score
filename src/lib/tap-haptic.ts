/** 指で押した瞬間の短い振動。アラームのような連続振動にはしない。 */
export const TAP_VIBRATION_MS = 20;

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
