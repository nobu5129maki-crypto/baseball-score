import type { Game, GameEvent, LineupSlot, PitcherOnly, Player, Team } from "./types";

export function sortOwnTeams(teams: Team[]): Team[] {
  return [...teams].sort(
    (a, b) => a.createdAt - b.createdAt || a.name.localeCompare(b.name, "ja"),
  );
}

/** 設定の activeTeamId があればそれ、なければ一番古い自チーム。 */
export function resolveActiveTeam(
  teams: Team[],
  activeTeamId?: string | null,
): Team | undefined {
  const sorted = sortOwnTeams(teams);
  if (sorted.length === 0) return undefined;
  if (activeTeamId) {
    const hit = sorted.find((t) => t.id === activeTeamId);
    if (hit) return hit;
  }
  return sorted[0];
}

export function teamDisplayName(team: Pick<Team, "name"> | undefined | null): string {
  const name = team?.name?.trim();
  return name || "自チーム";
}

export function normPlayerName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").trim();
}

/** 所属チーム。teamIds が無い古いデータは teamId だけ。 */
export function playerTeamIds(player: Pick<Player, "teamId" | "teamIds">): string[] {
  const extra = player.teamIds ?? [];
  const ids = extra.length > 0 ? extra : [player.teamId];
  if (!ids.includes(player.teamId)) return [player.teamId, ...ids];
  return [...new Set(ids)];
}

export function playerOnTeam(player: Pick<Player, "teamId" | "teamIds">, teamId: string): boolean {
  return playerTeamIds(player).includes(teamId);
}

export function playersOnTeam(players: Player[], teamId: string): Player[] {
  return players
    .filter((p) => playerOnTeam(p, teamId))
    .sort(
      (a, b) =>
        numberOnTeam(a, teamId).localeCompare(numberOnTeam(b, teamId), "ja", { numeric: true }) ||
        a.name.localeCompare(b.name, "ja"),
    );
}

export function numberOnTeam(player: Pick<Player, "number" | "numbersByTeam">, teamId: string): string {
  return player.numbersByTeam?.[teamId] ?? player.number;
}

export function withNumberOnTeam(player: Player, teamId: string, number: string): Player {
  const teamIds = playerTeamIds(player);
  const numbersByTeam = { ...player.numbersByTeam, [teamId]: number };
  const primary = player.teamId === teamId || teamIds.length <= 1;
  return {
    ...player,
    teamIds,
    numbersByTeam,
    number: primary ? number : player.number,
  };
}

/** 同じ選手のまま、もう一つの自チームの名簿に入れる。 */
export function addTeamToPlayer(player: Player, teamId: string): Player {
  const teamIds = playerTeamIds(player);
  if (teamIds.includes(teamId)) return player;
  const numbersByTeam = { ...player.numbersByTeam };
  if (numbersByTeam[player.teamId] == null) numbersByTeam[player.teamId] = player.number;
  numbersByTeam[teamId] = numberOnTeam(player, player.teamId);
  return { ...player, teamIds: [...teamIds, teamId], numbersByTeam };
}

/** このチームの名簿から外す。他チームに残るなら選手レコードは残す。 */
export function detachPlayerFromTeam(player: Player, teamId: string): Player | null {
  const teamIds = playerTeamIds(player).filter((id) => id !== teamId);
  if (teamIds.length === 0) return null;
  const numbersByTeam = { ...player.numbersByTeam };
  delete numbersByTeam[teamId];
  const nextTeamId = teamIds.includes(player.teamId) ? player.teamId : teamIds[0];
  return {
    ...player,
    teamId: nextTeamId,
    teamIds,
    numbersByTeam,
    number: numbersByTeam[nextTeamId] ?? player.number,
  };
}

export function otherTeamLabels(player: Player, teams: Team[], currentTeamId: string): string[] {
  const names = new Map(teams.map((t) => [t.id, t.name]));
  return playerTeamIds(player)
    .filter((id) => id !== currentTeamId)
    .map((id) => names.get(id))
    .filter((name): name is string => Boolean(name));
}

export type SameNameLink = { keepId: string; dropIds: string[]; name: string };

/**
 * 1部と2部に同名で別人として入っている選手を、チーム内で同名が一人なら同じ選手として結びつける。
 */
export function planSameNameLinks(players: Player[]): SameNameLink[] {
  const groups = new Map<string, Player[]>();
  for (const player of players) {
    const key = normPlayerName(player.name);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(player);
    groups.set(key, list);
  }
  const links: SameNameLink[] = [];
  for (const list of groups.values()) {
    if (new Set(list.map((p) => p.id)).size < 2) continue;
    const byTeam = new Map<string, Set<string>>();
    let ambiguous = false;
    for (const player of list) {
      for (const teamId of playerTeamIds(player)) {
        const set = byTeam.get(teamId) ?? new Set<string>();
        set.add(player.id);
        if (set.size > 1) ambiguous = true;
        byTeam.set(teamId, set);
      }
    }
    if (ambiguous) continue;
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    links.push({
      keepId: sorted[0].id,
      dropIds: sorted.slice(1).map((p) => p.id),
      name: sorted[0].name,
    });
  }
  return links;
}

export function mergeLinkedPlayers(
  players: Player[],
  links: SameNameLink[],
): { kept: Player[]; deleteIds: string[] } {
  const byId = new Map(players.map((p) => [p.id, p]));
  const deleteIds: string[] = [];
  const replaced = new Set<string>();
  const keptById = new Map<string, Player>();
  for (const link of links) {
    let keep = byId.get(link.keepId);
    if (!keep) continue;
    for (const dropId of link.dropIds) {
      const drop = byId.get(dropId);
      if (!drop) continue;
      for (const teamId of playerTeamIds(drop)) {
        keep = addTeamToPlayer(keep, teamId);
        keep = withNumberOnTeam(keep, teamId, numberOnTeam(drop, teamId));
      }
      deleteIds.push(dropId);
      replaced.add(dropId);
    }
    replaced.add(keep.id);
    keptById.set(keep.id, keep);
  }
  const kept = players.filter((p) => !replaced.has(p.id));
  kept.push(...keptById.values());
  return { kept, deleteIds };
}

export function remapGamePlayerIds(game: Game, idMap: Map<string, string>): Game {
  if (idMap.size === 0) return game;
  const mapId = (id: string) => idMap.get(id) ?? id;
  const slot = (row: LineupSlot): LineupSlot => ({ ...row, playerId: mapId(row.playerId) });
  const pitcher = (row?: PitcherOnly) => (row ? { ...row, playerId: mapId(row.playerId) } : row);
  const events: GameEvent[] = game.events.map((event) => {
    if (event.t === "play") {
      return { ...event, moves: event.moves.map((move) => ({ ...move, playerId: mapId(move.playerId) })) };
    }
    if (event.t === "sub" || event.t === "pr") return { ...event, playerId: mapId(event.playerId) };
    return event;
  });
  return {
    ...game,
    firstLineup: game.firstLineup.map(slot),
    secondLineup: game.secondLineup.map(slot),
    ...(game.firstPitcher ? { firstPitcher: pitcher(game.firstPitcher) } : {}),
    ...(game.secondPitcher ? { secondPitcher: pitcher(game.secondPitcher) } : {}),
    ...(game.opponentBench
      ? { opponentBench: game.opponentBench.map((row) => ({ ...row, playerId: mapId(row.playerId) })) }
      : {}),
    events,
  };
}

export type CanDeleteOwnTeamResult = "ok" | "last" | "has_games" | "not_found";

export function canDeleteOwnTeam(
  teams: Team[],
  games: Array<{ myTeamId: string }>,
  teamId: string,
): CanDeleteOwnTeamResult {
  if (!teams.some((t) => t.id === teamId)) return "not_found";
  if (teams.length <= 1) return "last";
  if (games.some((g) => g.myTeamId === teamId)) return "has_games";
  return "ok";
}

export function nextActiveTeamIdAfterDelete(
  teams: Team[],
  deletedId: string,
  currentActiveId?: string | null,
): string | undefined {
  const remaining = sortOwnTeams(teams.filter((t) => t.id !== deletedId));
  if (remaining.length === 0) return undefined;
  if (currentActiveId && currentActiveId !== deletedId) {
    const still = remaining.find((t) => t.id === currentActiveId);
    if (still) return still.id;
  }
  return remaining[0]?.id;
}

export function matchTeamByName(teams: Team[], name: string): Team | undefined {
  const key = normTeamName(name);
  if (!key) return undefined;
  return teams.find((t) => normTeamName(t.name) === key);
}

export function normTeamName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").trim();
}

/** チーム名変更で書き換える試合。同じ myTeamId だけ。他チーム（1部↔2部）は触らない。 */
export function gamesTouchedByTeamRename<T extends { myTeamId: string; myTeamName: string }>(
  games: T[],
  teamId: string,
  nextName: string,
): T[] {
  const next = nextName.trim();
  if (!next) return [];
  return games.filter((g) => g.myTeamId === teamId && g.myTeamName !== next);
}
