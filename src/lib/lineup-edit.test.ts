import { describe, expect, it } from "vitest";
import { nudgeLineup, swapLineupOrders } from "./lineup-edit";
import type { LineupSlot } from "./types";

const slots: LineupSlot[] = [
  { order: 1, playerId: "a", playerName: "佐藤", position: "P", throws: "left", grade: "6" },
  { order: 2, playerId: "b", playerName: "鈴木", position: "C", throws: "right" },
  { order: 3, playerId: "c", playerName: "高橋", position: "1B" },
];

describe("打順の入れ替え", () => {
  it("利き腕や学年は選手について移動し、元の枠に残らない", () => {
    const next = swapLineupOrders(slots, 1, 2);
    expect(next?.find((slot) => slot.order === 1)).toMatchObject({
      playerId: "b",
      playerName: "鈴木",
      position: "C",
      throws: "right",
    });
    expect(next?.find((slot) => slot.order === 1)?.grade).toBeUndefined();
    expect(next?.find((slot) => slot.order === 2)).toMatchObject({
      playerId: "a",
      playerName: "佐藤",
      position: "P",
      throws: "left",
      grade: "6",
    });
  });

  it("同じ選手の▼を続けて押すと、2つ下の打順まで動く", () => {
    const once = nudgeLineup(slots, "a", 1);
    const twice = once ? nudgeLineup(once, "a", 1) : null;
    expect(twice?.find((slot) => slot.playerId === "a")?.order).toBe(3);
    expect(twice?.find((slot) => slot.order === 1)?.playerId).toBe("b");
    expect(twice?.find((slot) => slot.order === 2)?.playerId).toBe("c");
  });

  it("端より外には動かない", () => {
    expect(nudgeLineup(slots, "a", -1)).toBeNull();
    expect(nudgeLineup(slots, "missing", 1)).toBeNull();
  });
});
