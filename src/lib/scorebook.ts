import { PLAY_SHORT, playLabel } from "./labels";
import { battingSide, getBatter, getLineup, reduceGame } from "./engine";
import type { Game, LineupSlot, PlayResult, Position, Side } from "./types";

export type ScorebookMark = {
  label: string;
};

export type ScorebookPlayer = {
  playerId: string;
  name: string;
  position: Position;
  via: "start" | "ph" | "pr" | "sub";
};

export type ScorebookOrder = {
  order: number;
  players: ScorebookPlayer[];
  innings: ScorebookMark[][];
};

export type ScorebookSide = {
  orders: ScorebookOrder[];
};

export type Scorebook = {
  innings: number;
  first: ScorebookSide;
  second: ScorebookSide;
};

export const REGULATION_DISPLAY_INNINGS = 9;
export const MAX_INNINGS = 12;

export function lastPlayedInning(game: Game): number {
  let last = 0;
  let cursor: Game = { ...game, events: [] };
  for (const event of game.events) {
    if (event.t === "end_game") continue;
    const before = reduceGame(cursor);
    last = Math.max(last, before.inning);
    cursor = { ...cursor, events: [...cursor.events, event] };
  }
  return last;
}

export function displayInnings(game: Game, liveInning = 0): number {
  const played = Math.max(lastPlayedInning(game), liveInning);
  return Math.min(MAX_INNINGS, Math.max(REGULATION_DISPLAY_INNINGS, played));
}

function bookPlayLabel(result: PlayResult, field?: Position): string {
  if (field) return playLabel(result, field);
  return PLAY_SHORT[result];
}

function emptySide(lineup: LineupSlot[], innings: number): ScorebookSide {
  return {
    orders: [...lineup]
      .sort((a, b) => a.order - b.order)
      .slice(0, 9)
      .map((slot) => ({
        order: slot.order,
        players: [
          {
            playerId: slot.playerId,
            name: slot.playerName,
            position: slot.position,
            via: "start",
          },
        ],
        innings: Array.from({ length: innings }, () => [] as ScorebookMark[]),
      })),
  };
}

function sideOf(book: Scorebook, side: Side): ScorebookSide {
  return side === "first" ? book.first : book.second;
}

function pushMark(side: ScorebookSide, battingOrder: number, inning: number, label: string) {
  const row = side.orders.find((o) => o.order === battingOrder);
  if (!row) return;
  const col = inning - 1;
  if (col < 0 || col >= row.innings.length) return;
  row.innings[col].push({ label });
}

function applyPlayerChange(
  side: ScorebookSide,
  order: number,
  playerId: string,
  name: string,
  position: Position,
  via: ScorebookPlayer["via"],
) {
  const row = side.orders.find((o) => o.order === order);
  if (!row) return;
  const last = row.players[row.players.length - 1];
  if (last && last.playerId === playerId) {
    last.position = position;
    last.name = name;
    return;
  }
  row.players.push({ playerId, name, position, via });
}

export function buildScorebook(game: Game): Scorebook {
  const innings = MAX_INNINGS;
  const book: Scorebook = {
    innings,
    first: emptySide(game.firstLineup, innings),
    second: emptySide(game.secondLineup, innings),
  };

  let cursor: Game = { ...game, events: [] };

  for (const event of game.events) {
    const before = reduceGame(cursor);
    const batting = battingSide(before.half);
    const battingBook = sideOf(book, batting);

    if (event.t === "play") {
      const batter = getBatter(before);
      pushMark(battingBook, batter.order, before.inning, bookPlayLabel(event.result, event.field));
      const scored = event.moves.filter((m) => m.to === 4).length;
      if (scored > 0 && event.result !== "homerun") {
        pushMark(battingBook, batter.order, before.inning, `${scored}点`);
      }
    } else if (event.t === "steal") {
      const runner = before.bases[event.from - 1];
      if (runner) {
        const label = event.to === "out" ? "盗死" : event.to === 4 ? "盗本" : "盗";
        pushMark(battingBook, runner.battingOrder, before.inning, label);
      }
    } else if (event.t === "pickoff") {
      const runner = before.bases[event.from - 1];
      if (runner) {
        pushMark(battingBook, runner.battingOrder, before.inning, "牽制");
      }
    } else if (event.t === "wp" || event.t === "pb" || event.t === "bk") {
      const label = event.t === "wp" ? "暴" : event.t === "pb" ? "捕逸" : "ボ";
      for (const runner of before.bases) {
        if (runner) pushMark(battingBook, runner.battingOrder, before.inning, label);
      }
    } else if (event.t === "pr") {
      const runner = before.bases[event.base - 1];
      const order = runner?.battingOrder ?? event.base;
      applyPlayerChange(battingBook, order, event.playerId, event.playerName, event.position, "pr");
      pushMark(battingBook, order, before.inning, "代走");
    } else if (event.t === "sub") {
      const teamBook = sideOf(book, event.side);
      const isBatting = event.side === batting;
      const batter = getBatter(before);
      const onBase = before.bases.some((b) => b?.battingOrder === event.order);
      let via: ScorebookPlayer["via"] = "sub";
      if (isBatting && batter.order === event.order) via = "ph";
      else if (isBatting && onBase) via = "pr";
      applyPlayerChange(teamBook, event.order, event.playerId, event.playerName, event.position, via);
      if (via === "ph") {
        pushMark(teamBook, event.order, before.inning, "代打");
      } else if (via === "pr") {
        pushMark(teamBook, event.order, before.inning, "代走");
      } else if (!isBatting) {
        const lineup = getLineup(before, event.side);
        const prev = lineup.find((s) => s.order === event.order);
        if (prev && prev.playerId !== event.playerId) {
          pushMark(teamBook, event.order, before.inning, "守交代");
        }
      }
    }

    cursor = { ...cursor, events: [...cursor.events, event] };
  }

  const used = displayInnings(game);
  return {
    innings: used,
    first: trimSide(book.first, used),
    second: trimSide(book.second, used),
  };
}

function trimSide(side: ScorebookSide, innings: number): ScorebookSide {
  return {
    orders: side.orders.map((row) => ({
      ...row,
      innings: row.innings.slice(0, innings),
    })),
  };
}
