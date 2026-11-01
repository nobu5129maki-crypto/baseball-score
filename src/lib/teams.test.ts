import { describe, expect, it } from "vitest";
import {
  canDeleteOwnTeam,
  copyPlayersToTeam,
  gamesTouchedByTeamRename,
  matchTeamByName,
  nextActiveTeamIdAfterDelete,
  resolveActiveTeam,
  sortOwnTeams,
} from "./teams";
import type { Player, Team } from "./types";

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

describe("copyPlayersToTeam", () => {
  it("別チーム用に新しい選手idを付ける", () => {
    const players: Player[] = [
      { id: "p1", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 },
    ];
    let n = 0;
    const copied = copyPlayersToTeam(players, "t2", () => `n${++n}`, 99);
    expect(copied).toEqual([
      { id: "n1", teamId: "t2", name: "佐藤", number: "1", createdAt: 99 },
    ]);
    expect(players[0].id).toBe("p1");
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
