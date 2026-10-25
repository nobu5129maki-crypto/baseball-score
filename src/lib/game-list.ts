import type { Game } from "./types";

/** 日付では捨てない。当日以外・昨日以前の試合もすべて残す。 */
export function gamesKeptAfterDateChange(games: Game[], _today: string): Game[] {
  return games;
}

export function sortGamesForHome(games: Game[]): Game[] {
  return [...games].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function splitGamesByStatus(games: Game[]): {
  active: Game[];
  setup: Game[];
  done: Game[];
} {
  return {
    active: games.filter((g) => g.status === "in_progress"),
    setup: games.filter((g) => g.status === "lineup"),
    done: games.filter((g) => g.status === "ended"),
  };
}
