import type { Game, PitcherOnly } from "./types";

/** 交代で外れた相手選手を控えに残す（打順にいる人は表示側で除外する） */
export function rememberOpponentBench(
  game: Game,
  player: Pick<PitcherOnly, "playerId" | "playerName" | "number">,
): Game {
  if (!player.playerId || !player.playerName.trim()) return game;
  const bench = game.opponentBench ?? [];
  if (bench.some((p) => p.playerId === player.playerId)) return game;
  const row: PitcherOnly = {
    playerId: player.playerId,
    playerName: player.playerName,
    ...(player.number ? { number: player.number } : {}),
  };
  return { ...game, opponentBench: [...bench, row] };
}

export function opponentBenchPlayers(game: Game): { id: string; name: string; number?: string }[] {
  return (game.opponentBench ?? []).map((p) => ({
    id: p.playerId,
    name: p.playerName,
    number: p.number,
  }));
}
