import { db } from "./db";
import type { Game, Player, RosterPack, Settings, Team } from "./types";

export const BACKUP_KIND = "rakuscore-backup";
export const BACKUP_VERSION = 1;

export type AppBackup = {
  kind: typeof BACKUP_KIND;
  v: typeof BACKUP_VERSION;
  exportedAt: number;
  teams: Team[];
  players: Player[];
  games: Game[];
  settings: Settings[];
  rosters: RosterPack[];
};

export type BackupParseResult =
  | { ok: true; backup: AppBackup }
  | { ok: false; message: string };

export function makeBackup(
  data: Omit<AppBackup, "kind" | "v" | "exportedAt">,
  exportedAt = Date.now(),
): AppBackup {
  return {
    kind: BACKUP_KIND,
    v: BACKUP_VERSION,
    exportedAt,
    teams: data.teams,
    players: data.players,
    games: data.games,
    settings: data.settings,
    rosters: data.rosters,
  };
}

export function stringifyBackup(backup: AppBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function gameBackupFileName(game: Pick<Game, "date" | "opponentName">): string {
  const opponent = game.opponentName.replace(/[\\/:*?"<>|]/g, "").trim() || "相手";
  return `らくスコア-試合-${game.date}-${opponent}.json`;
}

export async function collectGameBackup(gameId: string): Promise<AppBackup | null> {
  const game = await db.games.get(gameId);
  if (!game) return null;
  const [teams, players, rosters] = await Promise.all([
    db.teams.toArray(),
    db.players.toArray(),
    db.rosters.toArray(),
  ]);
  const team = teams.find((row) => row.id === game.myTeamId) ?? teams[0];
  const mine = players.filter((p) => p.teamId === game.myTeamId);
  return makeBackup({
    teams: team ? [team] : [],
    players: mine,
    games: [game],
    settings: [],
    rosters,
  });
}

export function backupFileName(exportedAt: number): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(exportedAt));
  return `らくスコア-バックアップ-${day}.json`;
}

export function backupSummary(backup: AppBackup): string {
  return `試合${backup.games.length}、選手${backup.players.length}`;
}

export function parseBackup(raw: string): BackupParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "このファイルは読み込めません。らくスコアのバックアップか確認してください。" };
  }
  if (!isObject(parsed) || parsed.kind !== BACKUP_KIND || parsed.v !== BACKUP_VERSION) {
    return { ok: false, message: "らくスコアのバックアップファイルではありません。" };
  }
  if (
    !Array.isArray(parsed.teams) ||
    !Array.isArray(parsed.players) ||
    !Array.isArray(parsed.games) ||
    !Array.isArray(parsed.settings) ||
    !Array.isArray(parsed.rosters)
  ) {
    return { ok: false, message: "バックアップの中身が欠けています。" };
  }
  for (const game of parsed.games) {
    if (!isObject(game) || typeof game.id !== "string" || !Array.isArray(game.events)) {
      return { ok: false, message: "試合データの形が違います。" };
    }
  }
  return {
    ok: true,
    backup: {
      kind: BACKUP_KIND,
      v: BACKUP_VERSION,
      exportedAt: typeof parsed.exportedAt === "number" ? parsed.exportedAt : Date.now(),
      teams: parsed.teams as Team[],
      players: parsed.players as Player[],
      games: parsed.games as Game[],
      settings: parsed.settings as Settings[],
      rosters: parsed.rosters as RosterPack[],
    },
  };
}

export async function collectBackup(): Promise<AppBackup> {
  const [teams, players, games, settings, rosters] = await Promise.all([
    db.teams.toArray(),
    db.players.toArray(),
    db.games.toArray(),
    db.settings.toArray(),
    db.rosters.toArray(),
  ]);
  return makeBackup({ teams, players, games, settings, rosters });
}

export async function restoreBackup(backup: AppBackup): Promise<void> {
  await db.transaction("rw", db.teams, db.players, db.games, db.settings, db.rosters, async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.games.clear();
    await db.settings.clear();
    await db.rosters.clear();
    if (backup.teams.length > 0) await db.teams.bulkPut(backup.teams);
    if (backup.players.length > 0) await db.players.bulkPut(backup.players);
    if (backup.games.length > 0) await db.games.bulkPut(backup.games);
    if (backup.settings.length > 0) await db.settings.bulkPut(backup.settings);
    if (backup.rosters.length > 0) await db.rosters.bulkPut(backup.rosters);
  });
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
