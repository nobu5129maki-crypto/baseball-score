import { describe, expect, it } from "vitest";
import { lineupFromPlayers } from "./seed";
import type { Player } from "./types";

describe("lineupFromPlayers", () => {
  it("背番号を打順に載せる", () => {
    const players: Player[] = [
      { id: "p1", teamId: "t1", name: "佐藤", number: "18", createdAt: 1 },
    ];
    expect(lineupFromPlayers(players)[0]).toMatchObject({
      playerName: "佐藤",
      number: "18",
      position: "P",
    });
  });
});
