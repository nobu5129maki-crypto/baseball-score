"use client";

import { useEffect } from "react";
import { buzzTap, isTapControl } from "@/lib/tap-haptic";

/** ボタンやリンクを指で押した瞬間に、短く一度振動する。 */
export function TapHaptic() {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest("button, a, [role='button']");
      if (!isTapControl(control)) return;
      buzzTap();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);
  return null;
}
