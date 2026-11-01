import type { Player, Team } from "./types";

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

/** 選手コピー用。新しい teamId / playerId を付けた名簿を作る。 */
export function copyPlayersToTeam(
  players: Player[],
  nextTeamId: string,
  newPlayerId: () => string,
  now = Date.now(),
): Player[] {
  return players.map((p) => ({
    ...p,
    id: newPlayerId(),
    teamId: nextTeamId,
    createdAt: now,
  }));
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
