import Dexie, { type EntityTable } from "dexie";
import { isEndedGameDeletable, type DeleteEndedGameResult } from "./game-delete";
import { gamesKeptAfterDateChange, sortGamesForHome } from "./game-list";
import { localDateKey } from "./game-time";
import { newId } from "./ids";
import {
  canDeleteOwnTeam,
  copyPlayersToTeam,
  gamesTouchedByTeamRename,
  nextActiveTeamIdAfterDelete,
  resolveActiveTeam,
  sortOwnTeams,
} from "./teams";
import type { Game, Player, RosterPack, Settings, Team } from "./types";

export type { DeleteEndedGameResult } from "./game-delete";

export class RakuScoreDB extends Dexie {
  teams!: EntityTable<Team, "id">;
  players!: EntityTable<Player, "id">;
  games!: EntityTable<Game, "id">;
  settings!: EntityTable<Settings, "id">;
  rosters!: EntityTable<RosterPack, "id">;

  constructor() {
    super("raku-score");
    this.version(1).stores({
      teams: "id, name",
      players: "id, teamId, name",
      games: "id, updatedAt, status",
      settings: "id",
    });
    this.version(2).stores({
      teams: "id, name",
      players: "id, teamId, name",
      games: "id, updatedAt, status",
      settings: "id",
      rosters: "id, name",
    });
    this.version(3).stores({
      teams: "id, name",
      players: "id, teamId, name",
      games: "id, updatedAt, status",
      settings: "id",
      rosters: "id, name, createdAt",
    });
  }
}

export const db = new RakuScoreDB();

/** 保存済みの試合を全部返す。当日以外も日付では消さない。 */
export async function loadAllGames(): Promise<Game[]> {
  const rows = await db.games.toArray();
  return sortGamesForHome(gamesKeptAfterDateChange(rows, localDateKey()));
}

export async function saveGame(game: Game): Promise<void> {
  await db.games.put({ ...game, updatedAt: Date.now() });
}

/** 終了した試合だけ削除できる。進行中・打順準備中は消さない。 */
export async function deleteEndedGame(gameId: string): Promise<DeleteEndedGameResult> {
  const game = await db.games.get(gameId);
  if (!game) return "not_found";
  if (!isEndedGameDeletable(game.status)) return "not_ended";
  await db.games.delete(gameId);
  return "deleted";
}

export async function saveTeamName(teamId: string, name: string): Promise<void> {
  const next = name.trim();
  if (!next) return;
  await db.teams.update(teamId, { name: next });
  const games = await db.games.toArray();
  const touched = gamesTouchedByTeamRename(games, teamId, next);
  if (touched.length === 0) return;
  await db.games.bulkPut(
    touched.map((g) => ({ ...g, myTeamName: next, updatedAt: Date.now() })),
  );
}

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get("app");
  if (row) return row;
  const fresh: Settings = { id: "app", leftHanded: false };
  await db.settings.put(fresh);
  return fresh;
}

export async function listOwnTeams(): Promise<Team[]> {
  return sortOwnTeams(await db.teams.toArray());
}

export async function getActiveTeam(): Promise<Team | undefined> {
  const [teams, settings] = await Promise.all([db.teams.toArray(), getSettings()]);
  return resolveActiveTeam(teams, settings.activeTeamId);
}

export async function setActiveTeamId(teamId: string): Promise<void> {
  const team = await db.teams.get(teamId);
  if (!team) return;
  const settings = await getSettings();
  await db.settings.put({ ...settings, activeTeamId: teamId });
}

export async function createOwnTeam(
  name: string,
  options?: { copyFromTeamId?: string },
): Promise<Team | null> {
  const next = name.trim();
  if (!next) return null;
  const now = Date.now();
  const team: Team = { id: newId(), name: next, createdAt: now };
  const sourceId = options?.copyFromTeamId;
  const [sourcePlayers, settings] = await Promise.all([
    sourceId ? db.players.where("teamId").equals(sourceId).toArray() : Promise.resolve([] as Player[]),
    getSettings(),
  ]);
  const copied = copyPlayersToTeam(sourcePlayers, team.id, newId, now);
  await db.transaction("rw", db.teams, db.players, db.settings, async () => {
    await db.teams.add(team);
    if (copied.length > 0) await db.players.bulkAdd(copied);
    await db.settings.put({ ...settings, activeTeamId: team.id });
  });
  return team;
}

export type DeleteOwnTeamResult = "deleted" | "last" | "has_games" | "not_found";

export async function deleteOwnTeam(teamId: string): Promise<DeleteOwnTeamResult> {
  const [teams, games, settings] = await Promise.all([
    db.teams.toArray(),
    db.games.toArray(),
    getSettings(),
  ]);
  const check = canDeleteOwnTeam(teams, games, teamId);
  if (check !== "ok") return check;
  const nextActive = nextActiveTeamIdAfterDelete(teams, teamId, settings.activeTeamId);
  await db.transaction("rw", db.teams, db.players, db.settings, async () => {
    await db.players.where("teamId").equals(teamId).delete();
    await db.teams.delete(teamId);
    await db.settings.put({
      ...settings,
      ...(nextActive ? { activeTeamId: nextActive } : { activeTeamId: undefined }),
    });
  });
  return "deleted";
}
