import type { LineupSlot } from "./types";

/** 打順番号は残し、選手情報（プロフィール含む）だけを入れ替える */
export function swapLineupOrders(
  slots: LineupSlot[],
  from: number,
  to: number,
): LineupSlot[] | null {
  if (from === to) return null;
  const a = slots.find((slot) => slot.order === from);
  const b = slots.find((slot) => slot.order === to);
  if (!a || !b) return null;
  return slots.map((slot) => {
    if (slot.order === from) return { ...b, order: from };
    if (slot.order === to) return { ...a, order: to };
    return { ...slot };
  });
}

/** 同じ選手を、いまの打順から delta 分動かす。連続タップは毎回最新の位置から進む */
export function nudgeLineup(
  slots: LineupSlot[],
  playerId: string,
  delta: number,
): LineupSlot[] | null {
  const current = slots.find((slot) => slot.playerId === playerId);
  if (!current) return null;
  return swapLineupOrders(slots, current.order, current.order + delta);
}
