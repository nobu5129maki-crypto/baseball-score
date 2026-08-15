import { playLabel } from "./labels";
import { battingSide, getBatter, reduceGame } from "./engine";
import type { Game, GameEvent, Half, PlayEvent, PlayResult, Side } from "./types";

export type PlayerSlash = {
  playerId: string;
  name: string;
  order: number;
  side: Side;
  ab: number;
  h: number;
  bb: number;
  hbp: number;
  sf: number;
  sh: number;
  tb: number;
  sb: number;
  cs: number;
  r: number;
};

export function plateAppearances(p: Pick<PlayerSlash, "ab" | "bb" | "hbp" | "sf" | "sh">): number {
  return p.ab + p.bb + p.hbp + p.sf + p.sh;
}

export function formatAvg(h: number, ab: number): string {
  if (ab === 0) return "-";
  const n = h / ab;
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, "");
}

export function formatObp(p: Pick<PlayerSlash, "h" | "bb" | "hbp" | "ab" | "sf">): string {
  const den = p.ab + p.bb + p.hbp + p.sf;
  if (den === 0) return "-";
  const n = (p.h + p.bb + p.hbp) / den;
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, "");
}

export function formatSlg(tb: number, ab: number): string {
  if (ab === 0) return "-";
  const n = tb / ab;
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, "");
}

export function formatOps(p: Pick<PlayerSlash, "h" | "bb" | "hbp" | "ab" | "sf" | "tb">): string {
  const den = p.ab + p.bb + p.hbp + p.sf;
  if (den === 0) return "-";
  const obp = (p.h + p.bb + p.hbp) / den;
  const slg = p.ab === 0 ? 0 : p.tb / p.ab;
  const n = obp + slg;
  if (n >= 1) return n.toFixed(3);
  return n.toFixed(3).replace(/^0/, "");
}

export function batterLine(p: PlayerSlash): string {
  const extra = [p.bb ? `四球${p.bb}` : "", p.sb ? `盗塁${p.sb}` : ""].filter(Boolean);
  const line = `${p.ab}打数${p.h}安打`;
  return extra.length ? `${line} ${extra.join(" ")}` : line;
}

export type AtBatNote = {
  inning: number;
  half: Half;
  label: string;
  result: PlayResult;
};

export function atBatsThisGame(
  game: Game,
  batter: { playerId: string; order: number },
  half: Half,
): AtBatNote[] {
  const side = battingSide(half);
  const notes: AtBatNote[] = [];
  let cursor: Game = { ...game, events: [] };
  for (const event of game.events) {
    if (event.t !== "play") {
      cursor = { ...cursor, events: [...cursor.events, event] };
      continue;
    }
    const before = reduceGame(cursor);
    const who = getBatter(before);
    if (battingSide(before.half) === side && who.playerId === batter.playerId) {
      const play = event as PlayEvent;
      notes.push({
        inning: before.inning,
        half: before.half,
        label: playLabel(play.result, play.field),
        result: play.result,
      });
    }
    cursor = { ...cursor, events: [...cursor.events, event] };
  }
  return notes;
}

function emptySlash(playerId: string, name: string, order: number, side: Side): PlayerSlash {
  return {
    playerId,
    name,
    order,
    side,
    ab: 0,
    h: 0,
    bb: 0,
    hbp: 0,
    sf: 0,
    sh: 0,
    tb: 0,
    sb: 0,
    cs: 0,
    r: 0,
  };
}

function isAb(result: PlayResult): boolean {
  return (
    result === "single" ||
    result === "double" ||
    result === "triple" ||
    result === "homerun" ||
    result === "strikeout" ||
    result === "dropped_third" ||
    result === "groundout" ||
    result === "flyout" ||
    result === "lineout" ||
    result === "gidp" ||
    result === "error" ||
    result === "fielders_choice" ||
    result === "runner_hit"
  );
}

function hitValue(result: PlayResult): number {
  if (result === "single") return 1;
  if (result === "double") return 2;
  if (result === "triple") return 3;
  if (result === "homerun") return 4;
  return 0;
}

export function gameSlashes(game: Game): PlayerSlash[] {
  const map = new Map<string, PlayerSlash>();
  const seed = (side: Side) => {
    const lineup = side === "first" ? game.firstLineup : game.secondLineup;
    for (const slot of lineup) {
      map.set(slot.playerId, emptySlash(slot.playerId, slot.playerName, slot.order, side));
    }
  };
  seed("first");
  seed("second");

  let cursor: Game = { ...game, events: [] };
  for (const event of game.events) {
    const before = reduceGame(cursor);
    cursor = { ...cursor, events: [...cursor.events, event] };
    applyEventToStats(map, event, before);
  }
  return [...map.values()].sort((a, b) => a.side.localeCompare(b.side) || a.order - b.order);
}

function applyEventToStats(
  map: Map<string, PlayerSlash>,
  event: GameEvent,
  before: ReturnType<typeof reduceGame>,
) {
  if (event.t === "play") {
    const batter = getBatter(before);
    const row = map.get(batter.playerId) ?? emptySlash(batter.playerId, batter.playerName, batter.order, battingSide(before.half));
    row.name = batter.playerName;
    const play = event as PlayEvent;
    if (isAb(play.result)) row.ab += 1;
    if (play.result === "walk") row.bb += 1;
    if (play.result === "hbp") row.hbp += 1;
    if (play.result === "sac_fly") row.sf += 1;
    if (play.result === "sac_bunt") row.sh += 1;
    const hv = hitValue(play.result);
    if (hv) {
      row.h += 1;
      row.tb += hv;
    }
    map.set(batter.playerId, row);
    for (const move of play.moves) {
      if (move.to === 4) {
        const scorer = map.get(move.playerId);
        if (scorer) scorer.r += 1;
      }
    }
  }
  if (event.t === "steal") {
    const runner = before.bases[event.from - 1];
    if (!runner) return;
    const row =
      map.get(runner.playerId) ??
      emptySlash(runner.playerId, runner.playerName, runner.battingOrder, battingSide(before.half));
    row.name = runner.playerName;
    if (event.to === "out") row.cs += 1;
    else row.sb += 1;
    map.set(runner.playerId, row);
  }
}

export function slashFor(game: Game, playerId: string): PlayerSlash | undefined {
  return gameSlashes(game).find((p) => p.playerId === playerId);
}

function addSlash(map: Map<string, PlayerSlash>, row: PlayerSlash) {
  const prev = map.get(row.playerId) ?? emptySlash(row.playerId, row.name, row.order, row.side);
  prev.name = row.name;
  prev.ab += row.ab;
  prev.h += row.h;
  prev.bb += row.bb;
  prev.hbp += row.hbp;
  prev.sf += row.sf;
  prev.sh += row.sh;
  prev.tb += row.tb;
  prev.sb += row.sb;
  prev.cs += row.cs;
  prev.r += row.r;
  map.set(row.playerId, prev);
}

export function mergeSlashes(games: Game[]): PlayerSlash[] {
  const map = new Map<string, PlayerSlash>();
  for (const game of games) {
    for (const row of gameSlashes(game)) addSlash(map, row);
  }
  return [...map.values()].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name, "ja"));
}

export function myTeamSlashes(games: Game[]): PlayerSlash[] {
  const map = new Map<string, PlayerSlash>();
  for (const game of games) {
    for (const row of gameSlashes(game)) {
      if (row.side !== game.mySide) continue;
      addSlash(map, row);
    }
  }
  return [...map.values()]
    .filter((p) => plateAppearances(p) + p.sb + p.cs > 0)
    .sort((a, b) => {
      const aAvg = a.ab === 0 ? -1 : a.h / a.ab;
      const bAvg = b.ab === 0 ? -1 : b.h / b.ab;
      return bAvg - aAvg || b.ab - a.ab || b.h - a.h || a.name.localeCompare(b.name, "ja");
    });
}
