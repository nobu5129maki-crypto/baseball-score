import type { Game } from "./types";

/** 最近使った相手チーム名（新しい順・重複なし） */
export function recentOpponentNames(games: Game[], limit = 8): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const sorted = [...games].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const game of sorted) {
    const name = game.opponentName.trim();
    if (!name) continue;
    const key = name.normalize("NFKC").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= limit) break;
  }
  return names;
}
