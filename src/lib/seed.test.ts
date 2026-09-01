import { describe, expect, it } from "vitest";
import { lineupFromPlayers, pitcherFromPlayers } from "./seed";
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

  it("DH制では1番が指名打者になる", () => {
    const players: Player[] = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      teamId: "t1",
      name: `選手${i + 1}`,
      number: String(i + 1),
      createdAt: 1,
    }));
    const lineup = lineupFromPlayers(players, true);
    expect(lineup).toHaveLength(9);
    expect(lineup[0].position).toBe("DH");
    expect(lineup.some((s) => s.position === "P")).toBe(false);
    expect(pitcherFromPlayers(players)).toMatchObject({
      playerId: "p9",
      playerName: "選手10",
    });
  });
});
