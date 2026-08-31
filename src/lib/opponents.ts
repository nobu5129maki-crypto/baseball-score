import type { Game } from "./types";

function recentUniqueNames(
  items: Array<{ value: string; updatedAt: number }>,
  limit: number,
): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const item of sorted) {
    const name = item.value.trim();
    if (!name) continue;
    const key = name.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}

/** 最近使った相手チーム名（新しい順・重複なし） */
export function recentOpponentNames(games: Game[], limit = 8): string[] {
  return recentUniqueNames(
    games.map((game) => ({ value: game.opponentName, updatedAt: game.updatedAt })),
    limit,
  );
}

/** 最近使った場所（新しい順・重複なし） */
export function recentVenueNames(games: Game[], limit = 8): string[] {
  return recentUniqueNames(
    games
      .filter((game) => game.venue)
      .map((game) => ({ value: game.venue!, updatedAt: game.updatedAt })),
    limit,
  );
}
