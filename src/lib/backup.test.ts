import { describe, expect, it } from "vitest";
import {
  BACKUP_KIND,
  backupFileName,
  backupSummary,
  gameBackupFileName,
  makeBackup,
  parseBackup,
  stringifyBackup,
} from "./backup";
import type { Game, Player, Team } from "./types";

function sample(): ReturnType<typeof makeBackup> {
  const team: Team = { id: "t1", name: "ひまわり", createdAt: 1 };
  const player: Player = { id: "p1", teamId: "t1", name: "佐藤", number: "1", createdAt: 1 };
  const game: Game = {
    id: "g1",
    myTeamId: "t1",
    myTeamName: "ひまわり",
    opponentName: "相手",
    mySide: "second",
    scheduledInnings: 7,
    date: "2026-08-15",
    status: "ended",
    firstLineup: [],
    secondLineup: [],
    events: [{ id: "e1", seq: 1, t: "end_game" }],
    createdAt: 1,
    updatedAt: 2,
  };
  return makeBackup(
    {
      teams: [team],
      players: [player],
      games: [game],
      settings: [{ id: "app", leftHanded: true }],
      rosters: [{ id: "r1", name: "相手", players: [{ name: "相手1", number: "9" }], createdAt: 3 }],
    },
    1_755_216_000_000,
  );
}

describe("backup", () => {
  it("JSONの往復で試合と選手が残る", () => {
    const original = sample();
    const parsed = parseBackup(stringifyBackup(original));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.backup.kind).toBe(BACKUP_KIND);
    expect(parsed.backup.games[0].id).toBe("g1");
    expect(parsed.backup.games[0].events[0].t).toBe("end_game");
    expect(parsed.backup.players[0].name).toBe("佐藤");
    expect(parsed.backup.settings[0].leftHanded).toBe(true);
    expect(parsed.backup.rosters[0].name).toBe("相手");
  });

  it("ファイル名は日付付きになる", () => {
    expect(backupFileName(Date.UTC(2026, 7, 15, 3, 0, 0))).toBe("らくスコア-バックアップ-2026-08-15.json");
    expect(gameBackupFileName({ date: "2026-08-16", opponentName: "太陽" })).toBe(
      "らくスコア-試合-2026-08-16-太陽.json",
    );
  });

  it("件数の要約が出る", () => {
    expect(backupSummary(sample())).toBe("試合1、選手1");
  });

  it("別アプリのJSONは拒否する", () => {
    const parsed = parseBackup(JSON.stringify({ v: 1, name: "ひまわり", players: [] }));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("バックアップ");
  });

  it("壊れたテキストは拒否する", () => {
    const parsed = parseBackup("これはバックアップではない");
    expect(parsed.ok).toBe(false);
  });

  it("試合idがないデータは拒否する", () => {
    const broken = sample();
    const raw = stringifyBackup(broken).replace('"id": "g1"', '"id": 1');
    const parsed = parseBackup(raw);
    expect(parsed.ok).toBe(false);
  });
});
