import { describe, expect, it } from "vitest";
import { makeBackup } from "./backup";
import { mergeSummary, planMerge, playerKey } from "./backup-merge";
import type { Game, Player, Team } from "./types";

function team(id: string, name = "ひまわり"): Team {
  return { id, name, createdAt: 1 };
}

function player(id: string, name: string, number: string, teamId: string): Player {
  return { id, teamId, name, number, createdAt: 1 };
}

function game(id: string, myTeamId: string, batterId: string): Game {
  return {
    id,
    myTeamId,
    myTeamName: "別端末",
    opponentName: "相手",
    mySide: "first",
    scheduledInnings: 7,
    date: "2026-08-16",
    status: "ended",
    firstLineup: [{ order: 1, playerId: batterId, playerName: "佐藤", position: "P", number: "1" }],
    secondLineup: [],
    events: [
      {
        id: "e1",
        seq: 1,
        t: "play",
        result: "single",
        field: "LF",
        moves: [{ playerId: batterId, from: 0, to: 1 }],
      },
    ],
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("planMerge", () => {
  it("名前と背番号が同じ選手は結びつけて試合を足す", () => {
    const localPlayer = player("a-sato", "佐藤", "1", "t-a");
    const incomingPlayer = player("b-sato", "佐藤", "01", "t-b");
    const incomingGame = game("g-b", "t-b", "b-sato");
    const plan = planMerge(
      { teams: [team("t-a")], players: [localPlayer], games: [], rosters: [] },
      makeBackup({
        teams: [team("t-b")],
        players: [incomingPlayer],
        games: [incomingGame],
        settings: [],
        rosters: [],
      }),
    );
    expect(plan.result).toEqual({ addedGames: 1, skippedGames: 0, addedPlayers: 0, linkedPlayers: 1 });
    expect(plan.gamesToPut[0].myTeamId).toBe("t-a");
    expect(plan.gamesToPut[0].myTeamName).toBe("ひまわり");
    expect(plan.gamesToPut[0].firstLineup[0].playerId).toBe("a-sato");
    expect(plan.gamesToPut[0].events[0]).toMatchObject({
      t: "play",
      moves: [{ playerId: "a-sato" }],
    });
    expect(plan.playersToPut).toHaveLength(0);
  });

  it("同じ試合idは二度足さない", () => {
    const localGame = game("g1", "t-a", "a-sato");
    const plan = planMerge(
      {
        teams: [team("t-a")],
        players: [player("a-sato", "佐藤", "1", "t-a")],
        games: [localGame],
        rosters: [],
      },
      makeBackup({
        teams: [team("t-b")],
        players: [player("b-sato", "佐藤", "1", "t-b")],
        games: [game("g1", "t-b", "b-sato")],
        settings: [],
        rosters: [],
      }),
    );
    expect(plan.result.addedGames).toBe(0);
    expect(plan.result.skippedGames).toBe(1);
    expect(plan.gamesToPut).toHaveLength(0);
  });

  it("名簿にいない選手は追加する", () => {
    const plan = planMerge(
      { teams: [team("t-a")], players: [player("a-sato", "佐藤", "1", "t-a")], games: [], rosters: [] },
      makeBackup({
        teams: [team("t-b")],
        players: [player("b-new", "鈴木", "8", "t-b")],
        games: [game("g-new", "t-b", "b-new")],
        settings: [],
        rosters: [],
      }),
    );
    expect(plan.result.addedPlayers).toBe(1);
    expect(plan.playersToPut[0]).toMatchObject({ id: "b-new", teamId: "t-a", name: "鈴木", number: "8" });
    expect(plan.gamesToPut[0].firstLineup[0].playerId).toBe("b-new");
  });

  it("代打の選手idも結びつける", () => {
    const incoming: Game = {
      ...game("g-ph", "t-b", "b-sato"),
      events: [
        {
          id: "s1",
          seq: 1,
          t: "sub",
          side: "first",
          order: 1,
          playerId: "b-ph",
          playerName: "代打太",
          position: "P",
          number: "7",
        },
      ],
    };
    const plan = planMerge(
      {
        teams: [team("t-a")],
        players: [player("a-sato", "佐藤", "1", "t-a"), player("a-ph", "代打太", "7", "t-a")],
        games: [],
        rosters: [],
      },
      makeBackup({
        teams: [team("t-b")],
        players: [player("b-sato", "佐藤", "1", "t-b"), player("b-ph", "代打太", "7", "t-b")],
        games: [incoming],
        settings: [],
        rosters: [],
      }),
    );
    expect(plan.gamesToPut[0].events[0]).toMatchObject({ t: "sub", playerId: "a-ph" });
  });
});

describe("mergeSummary", () => {
  it("足した件数を日本語で出す", () => {
    expect(mergeSummary({ addedGames: 1, skippedGames: 0, addedPlayers: 0, linkedPlayers: 9 })).toContain("試合1を足しました");
    expect(mergeSummary({ addedGames: 1, skippedGames: 0, addedPlayers: 0, linkedPlayers: 9 })).toContain("結びつけました");
  });
});

describe("playerKey", () => {
  it("全角数字と先頭ゼロを同じ背番号にする", () => {
    expect(playerKey("佐藤", "01")).toBe(playerKey("佐藤", "1"));
    expect(playerKey("佐藤", "１")).toBe(playerKey("佐藤", "1"));
  });
});
