import { db } from "./db";
import { newId } from "./ids";
import { matchTeamByName, normTeamName } from "./teams";
import type { AppBackup } from "./backup";
import type { Game, GameEvent, LineupSlot, Player, RosterPack, Team } from "./types";

export type MergeLocal = {
  teams: Team[];
  players: Player[];
  games: Game[];
  rosters: RosterPack[];
};

export type MergeResult = {
  addedGames: number;
  skippedGames: number;
  addedPlayers: number;
  linkedPlayers: number;
};

export type MergePlan = {
  teamsToPut: Team[];
  playersToPut: Player[];
  gamesToPut: Game[];
  rostersToPut: RosterPack[];
  result: MergeResult;
};

export function mergeSummary(result: MergeResult): string {
  const parts = [`試合${result.addedGames}を足しました`];
  if (result.skippedGames) parts.push(`すでにあった試合${result.skippedGames}件は飛ばしました`);
  if (result.addedPlayers) parts.push(`選手${result.addedPlayers}人を名簿に追加しました`);
  if (result.linkedPlayers) parts.push(`選手${result.linkedPlayers}人を名前と背番号で結びつけました`);
  return `${parts.join("。")}。今ある試合は消していません。`;
}

export function planMerge(local: MergeLocal, incoming: AppBackup, now = Date.now()): MergePlan {
  const teamsToPut: Team[] = [];
  const playersToPut: Player[] = [];
  const gamesToPut: Game[] = [];
  const rostersToPut: RosterPack[] = [];
  const result: MergeResult = { addedGames: 0, skippedGames: 0, addedPlayers: 0, linkedPlayers: 0 };

  const knownTeams = [...local.teams];
  const teamIdMap = new Map<string, string>();

  const ensureLocalTeam = (incomingTeam: Team | undefined, fallbackName: string): Team => {
    if (incomingTeam) {
      const mapped = teamIdMap.get(incomingTeam.id);
      if (mapped) {
        const existing = knownTeams.find((t) => t.id === mapped);
        if (existing) return existing;
      }
      const byName = matchTeamByName(knownTeams, incomingTeam.name);
      if (byName) {
        teamIdMap.set(incomingTeam.id, byName.id);
        return byName;
      }
      const created: Team = { ...incomingTeam };
      if (knownTeams.some((t) => t.id === created.id) || teamsToPut.some((t) => t.id === created.id)) {
        created.id = newId();
      }
      knownTeams.push(created);
      teamsToPut.push(created);
      teamIdMap.set(incomingTeam.id, created.id);
      return created;
    }
    const byName = matchTeamByName(knownTeams, fallbackName);
    if (byName) return byName;
    if (knownTeams[0]) return knownTeams[0];
    const created: Team = {
      id: newId(),
      name: fallbackName.trim() || "自チーム",
      createdAt: now,
    };
    knownTeams.push(created);
    teamsToPut.push(created);
    return created;
  };

  if (incoming.teams.length > 0) {
    for (const incomingTeam of incoming.teams) ensureLocalTeam(incomingTeam, incomingTeam.name);
  } else if (knownTeams.length === 0) {
    ensureLocalTeam(undefined, incoming.games[0]?.myTeamName?.trim() || "自チーム");
  }

  const defaultTeam = knownTeams[0] ?? ensureLocalTeam(undefined, "自チーム");

  const usedPlayerIds = new Set(local.players.map((p) => p.id));
  const byTeamKey = new Map<string, Player>();
  const byTeamName: Map<string, Player[]> = new Map();
  for (const player of local.players) {
    byTeamKey.set(`${player.teamId}\0${playerKey(player.name, player.number)}`, player);
    const nameKey = `${player.teamId}\0${normName(player.name)}`;
    const list = byTeamName.get(nameKey) ?? [];
    list.push(player);
    byTeamName.set(nameKey, list);
  }

  const idMap = new Map<string, string>();
  for (const incomingPlayer of incoming.players) {
    const localTeam =
      (incomingPlayer.teamId && teamIdMap.has(incomingPlayer.teamId)
        ? knownTeams.find((t) => t.id === teamIdMap.get(incomingPlayer.teamId))
        : undefined) ??
      matchTeamByName(
        knownTeams,
        incoming.teams.find((t) => t.id === incomingPlayer.teamId)?.name ?? defaultTeam.name,
      ) ??
      defaultTeam;
    if (incomingPlayer.teamId) teamIdMap.set(incomingPlayer.teamId, localTeam.id);

    const key = `${localTeam.id}\0${playerKey(incomingPlayer.name, incomingPlayer.number)}`;
    let localPlayer = byTeamKey.get(key);
    if (!localPlayer && !normNumber(incomingPlayer.number)) {
      const sameName = byTeamName.get(`${localTeam.id}\0${normName(incomingPlayer.name)}`) ?? [];
      if (sameName.length === 1) localPlayer = sameName[0];
    }
    if (localPlayer) {
      idMap.set(incomingPlayer.id, localPlayer.id);
      if (incomingPlayer.id !== localPlayer.id) result.linkedPlayers += 1;
      continue;
    }
    let nextId = incomingPlayer.id;
    if (usedPlayerIds.has(nextId)) nextId = newId();
    usedPlayerIds.add(nextId);
    const added: Player = {
      ...incomingPlayer,
      id: nextId,
      teamId: localTeam.id,
    };
    playersToPut.push(added);
    byTeamKey.set(key, added);
    idMap.set(incomingPlayer.id, nextId);
    result.addedPlayers += 1;
  }

  const localGameIds = new Set(local.games.map((g) => g.id));
  for (const game of incoming.games) {
    if (localGameIds.has(game.id)) {
      result.skippedGames += 1;
      continue;
    }
    const incomingTeam = incoming.teams.find((t) => t.id === game.myTeamId);
    const localTeam = ensureLocalTeam(incomingTeam, game.myTeamName || defaultTeam.name);
    gamesToPut.push(remapGame(game, localTeam, idMap));
    localGameIds.add(game.id);
    result.addedGames += 1;
  }

  const rosterNames = new Set(local.rosters.map((r) => normTeamName(r.name)));
  for (const roster of incoming.rosters) {
    if (rosterNames.has(normTeamName(roster.name))) continue;
    const next =
      local.rosters.some((r) => r.id === roster.id) || rostersToPut.some((r) => r.id === roster.id)
        ? { ...roster, id: newId() }
        : roster;
    rostersToPut.push(next);
    rosterNames.add(normTeamName(next.name));
  }

  return { teamsToPut, playersToPut, gamesToPut, rostersToPut, result };
}

export async function mergeBackup(incoming: AppBackup): Promise<MergeResult> {
  const [teams, players, games, rosters] = await Promise.all([
    db.teams.toArray(),
    db.players.toArray(),
    db.games.toArray(),
    db.rosters.toArray(),
  ]);
  const plan = planMerge({ teams, players, games, rosters }, incoming);
  await db.transaction("rw", db.teams, db.players, db.games, db.rosters, async () => {
    if (plan.teamsToPut.length > 0) await db.teams.bulkPut(plan.teamsToPut);
    if (plan.playersToPut.length > 0) await db.players.bulkPut(plan.playersToPut);
    if (plan.gamesToPut.length > 0) await db.games.bulkPut(plan.gamesToPut);
    if (plan.rostersToPut.length > 0) await db.rosters.bulkPut(plan.rostersToPut);
  });
  return plan.result;
}

function remapGame(game: Game, team: Team, idMap: Map<string, string>): Game {
  return {
    ...game,
    myTeamId: team.id,
    myTeamName: team.name,
    firstLineup: game.firstLineup.map((slot) => remapSlot(slot, idMap)),
    secondLineup: game.secondLineup.map((slot) => remapSlot(slot, idMap)),
    events: game.events.map((event) => remapEvent(event, idMap)),
  };
}

function remapSlot(slot: LineupSlot, idMap: Map<string, string>): LineupSlot {
  return { ...slot, playerId: idMap.get(slot.playerId) ?? slot.playerId };
}

function remapEvent(event: GameEvent, idMap: Map<string, string>): GameEvent {
  if (event.t === "play") {
    return {
      ...event,
      moves: event.moves.map((move) => ({
        ...move,
        playerId: idMap.get(move.playerId) ?? move.playerId,
      })),
    };
  }
  if (event.t === "sub" || event.t === "pr") {
    return { ...event, playerId: idMap.get(event.playerId) ?? event.playerId };
  }
  return event;
}

export function playerKey(name: string, number: string): string {
  return `${normName(name)}\0${normNumber(number)}`;
}

function normName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").trim();
}

function normNumber(number: string): string {
  const text = number.normalize("NFKC").trim();
  if (!text) return "";
  return text.replace(/^0+(?=\d+$)/, "");
}
