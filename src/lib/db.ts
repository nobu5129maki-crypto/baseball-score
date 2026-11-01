import Dexie, { type EntityTable } from "dexie";
import { isEndedGameDeletable, type DeleteEndedGameResult } from "./game-delete";
import { gamesKeptAfterDateChange, sortGamesForHome } from "./game-list";
import { localDateKey } from "./game-time";
import { newId } from "./ids";
import {
  addTeamToPlayer,
  canDeleteOwnTeam,
  detachPlayerFromTeam,
  gamesTouchedByTeamRename,
  mergeLinkedPlayers,
  nextActiveTeamIdAfterDelete,
  planSameNameLinks,
  numberOnTeam,
  playersOnTeam,
  remapGamePlayerIds,
  resolveActiveTeam,
  sortOwnTeams,
  withNumberOnTeam,
} from "./teams";
import { compactPlayer, pickPlayerProfile } from "./player-profile";
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
  const [allPlayers, settings] = await Promise.all([db.players.toArray(), getSettings()]);
  const shared = sourceId
    ? playersOnTeam(allPlayers, sourceId).map((player) => addTeamToPlayer(player, team.id))
    : [];
  await db.transaction("rw", db.teams, db.players, db.settings, async () => {
    await db.teams.add(team);
    if (shared.length > 0) await db.players.bulkPut(shared);
    await db.settings.put({ ...settings, activeTeamId: team.id });
  });
  return team;
}

export async function loadPlayersOnTeam(teamId: string): Promise<Player[]> {
  return playersOnTeam(await db.players.toArray(), teamId).map((player) => ({
    ...player,
    number: numberOnTeam(player, teamId),
  }));
}

export async function savePlayerOnTeam(player: Player, teamId: string): Promise<void> {
  const stored = (await db.players.get(player.id)) ?? player;
  const next = withNumberOnTeam(
    {
      ...stored,
      name: player.name.trim(),
      kana: player.kana,
      ...pickPlayerProfile(player),
    },
    teamId,
    player.number,
  );
  await db.players.put(compactPlayer(next));
}

export async function removePlayerFromTeam(playerId: string, teamId: string): Promise<"removed" | "not_found"> {
  const player = await db.players.get(playerId);
  if (!player) return "not_found";
  const next = detachPlayerFromTeam(player, teamId);
  if (!next) await db.players.delete(playerId);
  else await db.players.put(compactPlayer(next));
  return "removed";
}

export async function addPlayerToTeam(
  teamId: string,
  input: { name: string; number: string } & Parameters<typeof pickPlayerProfile>[0],
): Promise<Player | null> {
  const name = input.name.trim();
  if (!name) return null;
  const team = await db.teams.get(teamId);
  if (!team) return null;
  const player: Player = {
    id: newId(),
    teamId,
    teamIds: [teamId],
    name,
    number: input.number.trim(),
    ...pickPlayerProfile(input),
    createdAt: Date.now(),
  };
  await db.players.add(compactPlayer(player));
  return player;
}

export async function addExistingPlayerToTeam(playerId: string, teamId: string): Promise<Player | null> {
  const player = await db.players.get(playerId);
  const team = await db.teams.get(teamId);
  if (!player || !team) return null;
  const next = compactPlayer(addTeamToPlayer(player, teamId));
  await db.players.put(next);
  return next;
}

export async function linkOverlappingPlayers(): Promise<number> {
  const [players, games] = await Promise.all([db.players.toArray(), db.games.toArray()]);
  const links = planSameNameLinks(players);
  if (links.length === 0) return 0;
  const { kept, deleteIds } = mergeLinkedPlayers(players, links);
  const idMap = new Map<string, string>();
  for (const link of links) {
    for (const dropId of link.dropIds) idMap.set(dropId, link.keepId);
  }
  const gamesToPut = games
    .map((game) => remapGamePlayerIds(game, idMap))
    .filter((game, index) => game !== games[index]);
  await db.transaction("rw", db.players, db.games, async () => {
    if (kept.length > 0) await db.players.bulkPut(kept.map((player) => compactPlayer(player)));
    if (deleteIds.length > 0) await db.players.bulkDelete(deleteIds);
    if (gamesToPut.length > 0) await db.games.bulkPut(gamesToPut);
  });
  return deleteIds.length;
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
  const players = await db.players.toArray();
  const onTeam = players.filter((player) => playersOnTeam([player], teamId).length > 0);
  await db.transaction("rw", db.teams, db.players, db.settings, async () => {
    for (const player of onTeam) {
      const next = detachPlayerFromTeam(player, teamId);
      if (!next) await db.players.delete(player.id);
      else await db.players.put(compactPlayer(next));
    }
    await db.teams.delete(teamId);
    await db.settings.put({
      ...settings,
      ...(nextActive ? { activeTeamId: nextActive } : { activeTeamId: undefined }),
    });
  });
  return "deleted";
}
