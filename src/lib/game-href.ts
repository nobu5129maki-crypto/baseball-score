export type GameScreen = "lineup" | "score" | "setup" | "summary";

/** 試合 ID はパスにせずクエリにする。静的書き出しでも未知の ID を開ける。 */
export function gameHref(id: string, screen: GameScreen): string {
  return `/games/${screen}?id=${encodeURIComponent(id)}`;
}
