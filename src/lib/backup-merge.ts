import { db } from "./db";
import { newId } from "./ids";
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

  let team = local.teams[0];
  if (!team) {
    team = incoming.teams[0]
      ? { ...incoming.teams[0] }
      : { id: newId(), name: incoming.games[0]?.myTeamName?.trim() || "自チーム", createdAt: now };
    teamsToPut.push(team);
  }

  const usedPlayerIds = new Set(local.players.map((p) => p.id));
  const byKey = new Map<string, Player>();
  const byName: Map<string, Player[]> = new Map();
  for (const player of local.players) {
    byKey.set(playerKey(player.name, player.number), player);
    const name = normName(player.name);
    const list = byName.get(name) ?? [];
    list.push(player);
    byName.set(name, list);
  }

  const idMap = new Map<string, string>();
  for (const incomingPlayer of incoming.players) {
    const key = playerKey(incomingPlayer.name, incomingPlayer.number);
    let localPlayer = byKey.get(key);
    if (!localPlayer && !normNumber(incomingPlayer.number)) {
      const sameName = byName.get(normName(incomingPlayer.name)) ?? [];
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
      teamId: team.id,
    };
    playersToPut.push(added);
    byKey.set(key, added);
    idMap.set(incomingPlayer.id, nextId);
    result.addedPlayers += 1;
  }

  const localGameIds = new Set(local.games.map((g) => g.id));
  for (const game of incoming.games) {
    if (localGameIds.has(game.id)) {
      result.skippedGames += 1;
      continue;
    }
    gamesToPut.push(remapGame(game, team, idMap));
    localGameIds.add(game.id);
    result.addedGames += 1;
  }

  const rosterNames = new Set(local.rosters.map((r) => normName(r.name)));
  for (const roster of incoming.rosters) {
    if (rosterNames.has(normName(roster.name))) continue;
    const next = local.rosters.some((r) => r.id === roster.id) || rostersToPut.some((r) => r.id === roster.id)
      ? { ...roster, id: newId() }
      : roster;
    rostersToPut.push(next);
    rosterNames.add(normName(next.name));
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
