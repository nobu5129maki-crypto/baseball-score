import type { GameStatus } from "./types";

export type DeleteEndedGameResult = "deleted" | "not_found" | "not_ended";

/** 終了した試合だけ削除対象にする。 */
export function isEndedGameDeletable(status: GameStatus | undefined): boolean {
  return status === "ended";
}
