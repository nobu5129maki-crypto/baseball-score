import Dexie, { type EntityTable } from "dexie";
import type { Game, Player, RosterPack, Settings, Team } from "./types";

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
  }
}

export const db = new RakuScoreDB();

export async function saveGame(game: Game): Promise<void> {
  await db.games.put({ ...game, updatedAt: Date.now() });
}

export async function saveTeamName(teamId: string, name: string): Promise<void> {
  const next = name.trim();
  if (!next) return;
  await db.teams.update(teamId, { name: next });
  const games = await db.games.toArray();
  const touched = games.filter((g) => g.myTeamId === teamId && g.myTeamName !== next);
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
