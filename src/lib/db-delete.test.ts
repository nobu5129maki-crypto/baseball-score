import { describe, expect, it } from "vitest";
import { isEndedGameDeletable } from "./game-delete";

describe("isEndedGameDeletable", () => {
  it("終了試合だけ消せる", () => {
    expect(isEndedGameDeletable("ended")).toBe(true);
    expect(isEndedGameDeletable("in_progress")).toBe(false);
    expect(isEndedGameDeletable("lineup")).toBe(false);
    expect(isEndedGameDeletable(undefined)).toBe(false);
  });
});
