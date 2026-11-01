import { describe, expect, it } from "vitest";
import {
  addTeamToPlayer,
  canDeleteOwnTeam,
  detachPlayerFromTeam,
  gamesTouchedByTeamRename,
  matchTeamByName,
  mergeLinkedPlayers,
  nextActiveTeamIdAfterDelete,
  numberOnTeam,
  planSameNameLinks,
  playerOnTeam,
  playersOnTeam,
  remapGamePlayerIds,
  resolveActiveTeam,
  sortOwnTeams,
  withNumberOnTeam,
} from "./teams";
import type { Game, Player, Team } from "./types";

function team(id: string, name: string, createdAt: number): Team {
  return { id, name, createdAt };
}

describe("resolveActiveTeam", () => {
  it("activeTeamId があればそのチーム、なければ一番古いチーム", () => {
    const teams = [team("b", "2部", 20), team("a", "1部", 10)];
    expect(resolveActiveTeam(teams, "b")?.id).toBe("b");
    expect(resolveActiveTeam(teams, undefined)?.id).toBe("a");
    expect(resolveActiveTeam(teams, "missing")?.id).toBe("a");
    expect(resolveActiveTeam([], "a")).toBeUndefined();
  });
});

describe("gamesTouchedByTeamRename", () => {
  it("名前を変えても他チームの試合は書き換えない", () => {
    const games = [
      { id: "g1", myTeamId: "t1", myTeamName: "ひまわり1部" },
      { id: "g2", myTeamId: "t2", myTeamName: "ひまわり1部" },
      { id: "g3", myTeamId: "t1", myTeamName: "ひまわり1部" },
    ];
    const touched = gamesTouchedByTeamRename(games, "t2", "ひまわり2部");
    expect(touched.map((g) => g.id)).toEqual(["g2"]);
    expect(gamesTouchedByTeamRename(games, "t1", "ひまわり1部")).toEqual([]);
    expect(gamesTouchedByTeamRename(games, "t1", "ひまわりA").map((g) => g.id)).toEqual(["g1", "g3"]);
  });
});

describe("1部と2部で同じ選手", () => {
  const sato: Player = { id: "p1", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 };

  it("同じ選手idのまま、もう一方のチームの名簿に入る", () => {
    const shared = addTeamToPlayer(sato, "t2");
    expect(shared.id).toBe("p1");
    expect(playerOnTeam(shared, "t1")).toBe(true);
    expect(playerOnTeam(shared, "t2")).toBe(true);
    expect(playersOnTeam([shared], "t2").map((p) => p.id)).toEqual(["p1"]);
    expect(playersOnTeam([sato], "t2")).toEqual([]);
  });

  it("背番号はチームごとに変えられる", () => {
    const shared = withNumberOnTeam(addTeamToPlayer(sato, "t2"), "t2", "15");
    expect(numberOnTeam(shared, "t1")).toBe("1");
    expect(numberOnTeam(shared, "t2")).toBe("15");
    expect(shared.number).toBe("1");
  });

  it("片方の名簿から外しても、もう一方と選手レコードは残る", () => {
    const shared = addTeamToPlayer(sato, "t2");
    const left = detachPlayerFromTeam(shared, "t2");
    expect(left?.id).toBe("p1");
    expect(playerOnTeam(left!, "t1")).toBe(true);
    expect(playerOnTeam(left!, "t2")).toBe(false);
    expect(detachPlayerFromTeam(sato, "t1")).toBeNull();
  });

  it("同名で別人になっている選手は、チーム内で一人なら結びつける", () => {
    const first: Player = { id: "p1", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 };
    const second: Player = { id: "p2", teamId: "t2", name: "佐藤", number: "18", createdAt: 2 };
    const links = planSameNameLinks([first, second]);
    expect(links).toEqual([{ keepId: "p1", dropIds: ["p2"], name: "佐藤" }]);
    const { kept, deleteIds } = mergeLinkedPlayers([first, second], links);
    expect(deleteIds).toEqual(["p2"]);
    expect(kept).toHaveLength(1);
    expect(numberOnTeam(kept[0], "t2")).toBe("18");
    expect(playerOnTeam(kept[0], "t1")).toBe(true);
    const game = {
      id: "g",
      myTeamId: "t2",
      myTeamName: "2部",
      opponentName: "相手",
      mySide: "second",
      scheduledInnings: 7,
      date: "2026-08-13",
      status: "ended",
      firstLineup: [],
      secondLineup: [{ order: 1, playerId: "p2", playerName: "佐藤", position: "P", number: "18" }],
      events: [{ id: "e", seq: 1, t: "play", result: "single", moves: [{ playerId: "p2", from: 0, to: 1 }] }],
      createdAt: 1,
      updatedAt: 1,
    } as Game;
    const remapped = remapGamePlayerIds(game, new Map([["p2", "p1"]]));
    expect(remapped.secondLineup[0].playerId).toBe("p1");
    expect(remapped.events[0]).toMatchObject({ t: "play", moves: [{ playerId: "p1" }] });
  });

  it("同じチームに同名が二人いるときは結びつけない", () => {
    const a: Player = { id: "a", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 };
    const b: Player = { id: "b", teamId: "t1", name: "佐藤", number: "2", createdAt: 2 };
    expect(planSameNameLinks([a, b])).toEqual([]);
  });
});

describe("canDeleteOwnTeam / nextActiveTeamIdAfterDelete", () => {
  it("最後のチームや試合があるチームは消さない", () => {
    const teams = [team("a", "1部", 1), team("b", "2部", 2)];
    expect(canDeleteOwnTeam(teams, [], "a")).toBe("ok");
    expect(canDeleteOwnTeam([teams[0]], [], "a")).toBe("last");
    expect(canDeleteOwnTeam(teams, [{ myTeamId: "a" }], "a")).toBe("has_games");
    expect(canDeleteOwnTeam(teams, [], "x")).toBe("not_found");
  });

  it("削除後の選択中チームを決める", () => {
    const teams = [team("a", "1部", 1), team("b", "2部", 2)];
    expect(nextActiveTeamIdAfterDelete(teams, "a", "a")).toBe("b");
    expect(nextActiveTeamIdAfterDelete(teams, "a", "b")).toBe("b");
  });
});

describe("matchTeamByName / sortOwnTeams", () => {
  it("全角半角や空白を無視して同じチーム名とみなす", () => {
    const teams = [team("a", "ひまわり １部", 1)];
    expect(matchTeamByName(teams, "ひまわり1部")?.id).toBe("a");
  });

  it("作成順に並べる", () => {
    expect(sortOwnTeams([team("b", "2部", 20), team("a", "1部", 10)]).map((t) => t.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
