"use client";

import { useEffect } from "react";
import { buzzTap, isTapControl, shouldBuzzOnPointer } from "@/lib/tap-haptic";

function controlFrom(target: EventTarget | null): Element | null {
  const el = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  if (!el) return null;
  return el.closest("button, a, [role='button']");
}

/** ボタンやリンクをタップしたときに、短く一度振動する。 */
export function TapHaptic() {
  useEffect(() => {
    const onPointer = (event: PointerEvent) => {
      const type = event.type === "pointerdown" ? "pointerdown" : "pointerup";
      if (!shouldBuzzOnPointer(type, event.pointerType)) return;
      if (!isTapControl(controlFrom(event.target))) return;
      buzzTap();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("pointerup", onPointer, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("pointerup", onPointer, true);
    };
  }, []);
  return null;
}
