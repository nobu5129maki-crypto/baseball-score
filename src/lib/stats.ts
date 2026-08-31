import { playLabel } from "./labels";
import { battingSide, fieldingSide, getBatter, getLineup, otherSide, playAddsPitch, reduceGame, totalRuns } from "./engine";
import { playAwardsRbi, playHitValue, playIsAtBat } from "./rules";
import type { Game, GameEvent, Half, LineupSlot, PlayEvent, PlayResult, Side } from "./types";

export type PlayerSlash = {
  playerId: string;
  name: string;
  order: number;
  side: Side;
  ab: number;
  h: number;
  hr: number;
  rbi: number;
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

export type SlashSortKey = "name" | "pa" | "ab" | "h" | "bb" | "rbi" | "avg" | "obp" | "slg" | "sb" | "ops";
export type SortDir = "asc" | "desc";

function obpValue(p: Pick<PlayerSlash, "h" | "bb" | "hbp" | "ab" | "sf">): number | null {
  const den = p.ab + p.bb + p.hbp + p.sf;
  if (den === 0) return null;
  return (p.h + p.bb + p.hbp) / den;
}

function slgValue(p: Pick<PlayerSlash, "tb" | "ab">): number | null {
  if (p.ab === 0) return null;
  return p.tb / p.ab;
}

export function slashSortValue(p: PlayerSlash, key: SlashSortKey): number | string | null {
  if (key === "name") return p.name;
  if (key === "pa") return plateAppearances(p);
  if (key === "ab") return p.ab;
  if (key === "h") return p.h;
  if (key === "bb") return p.bb;
  if (key === "rbi") return p.rbi;
  if (key === "avg") return p.ab === 0 ? null : p.h / p.ab;
  if (key === "obp") return obpValue(p);
  if (key === "slg") return slgValue(p);
  if (key === "sb") return p.sb;
  const obp = obpValue(p);
  const slg = slgValue(p);
  if (obp == null && slg == null) return null;
  return (obp ?? 0) + (slg ?? 0);
}

export function compareSlashes(a: PlayerSlash, b: PlayerSlash, key: SlashSortKey, dir: SortDir): number {
  const av = slashSortValue(a, key);
  const bv = slashSortValue(b, key);
  if (av == null && bv == null) return a.name.localeCompare(b.name, "ja");
  if (av == null) return 1;
  if (bv == null) return -1;
  let cmp = 0;
  if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "ja");
  else cmp = (av as number) - (bv as number);
  if (cmp === 0) cmp = a.name.localeCompare(b.name, "ja");
  return dir === "asc" ? cmp : -cmp;
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
  const extra = [`打点${p.rbi}`, p.bb ? `四球${p.bb}` : "", p.sb ? `盗塁${p.sb}` : ""].filter(Boolean);
  return `${p.ab}打数${p.h}安打 ${extra.join(" ")}`;
}

export function batterAtBatLine(p: Pick<PlayerSlash, "ab" | "h" | "hr" | "rbi">): string {
  return `打率${formatAvg(p.h, p.ab)}（${p.ab}-${p.h}）本塁打${p.hr}打点${p.rbi}`;
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
    hr: 0,
    rbi: 0,
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
  return playIsAtBat(result);
}

function playRbi(result: PlayResult, moves: PlayEvent["moves"]): number {
  if (!playAwardsRbi(result)) return 0;
  return moves.filter((m) => m.to === 4).length;
}

function hitValue(result: PlayResult): number {
  return playHitValue(result);
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
    if (play.result === "homerun") row.hr += 1;
    row.rbi += playRbi(play.result, play.moves);
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

export function careerGames(games: Game[], teamId: string, current?: Game): Game[] {
  const pool = games.filter(
    (g) => g.myTeamId === teamId && (g.status === "ended" || g.status === "in_progress"),
  );
  if (current && !pool.some((g) => g.id === current.id)) pool.push(current);
  return pool;
}

export function slashAcrossGames(games: Game[], playerId: string): PlayerSlash | undefined {
  return mergeSlashes(games).find((p) => p.playerId === playerId);
}

export type PitcherLine = {
  playerId: string;
  name: string;
  pitches: number;
};

export function teamPitchers(game: Game, side: Side): PitcherLine[] {
  const rows: PitcherLine[] = [];
  const index = new Map<string, number>();

  const ensure = (slot: LineupSlot) => {
    const existing = index.get(slot.playerId);
    if (existing === undefined) {
      index.set(slot.playerId, rows.length);
      rows.push({ playerId: slot.playerId, name: slot.playerName, pitches: 0 });
      return;
    }
    rows[existing].name = slot.playerName;
  };

  let cursor: Game = { ...game, events: [] };
  const starter = pitcherOnSide(reduceGame(cursor), side);
  if (starter) ensure(starter);

  for (const event of game.events) {
    const before = reduceGame(cursor);
    if (
      ((event.t === "pitch" && fieldingSide(before.half) === side) ||
        (event.t === "play" && playAddsPitch(event.result, before) && fieldingSide(before.half) === side))
    ) {
      const pitcher = pitcherOnSide(before, side);
      if (pitcher) {
        ensure(pitcher);
        rows[index.get(pitcher.playerId)!].pitches += 1;
      }
    }
    cursor = { ...cursor, events: [...cursor.events, event] };
    const after = pitcherOnSide(reduceGame(cursor), side);
    if (after) ensure(after);
  }
  return rows;
}

export function myTeamPitchers(game: Game): PitcherLine[] {
  return teamPitchers(game, game.mySide);
}

function pitcherOnSide(state: ReturnType<typeof reduceGame>, side: Side): LineupSlot | undefined {
  return getLineup(state, side).find((slot) => slot.position === "P");
}

function addSlash(map: Map<string, PlayerSlash>, row: PlayerSlash) {
  const prev = map.get(row.playerId) ?? emptySlash(row.playerId, row.name, row.order, row.side);
  prev.name = row.name;
  prev.ab += row.ab;
  prev.h += row.h;
  prev.hr += row.hr;
  prev.rbi += row.rbi;
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

export function sumSlashes(rows: PlayerSlash[], name = "チーム計"): PlayerSlash {
  const acc = emptySlash("team-total", name, 0, "first");
  for (const row of rows) {
    acc.ab += row.ab;
    acc.h += row.h;
    acc.hr += row.hr;
    acc.rbi += row.rbi;
    acc.bb += row.bb;
    acc.hbp += row.hbp;
    acc.sf += row.sf;
    acc.sh += row.sh;
    acc.tb += row.tb;
    acc.sb += row.sb;
    acc.cs += row.cs;
    acc.r += row.r;
  }
  return acc;
}

export type TeamSeason = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  runsFor: number;
  runsAgainst: number;
  hitsFor: number;
  hitsAgainst: number;
  errors: number;
  batting: PlayerSlash;
};

export function myTeamSeason(games: Game[]): TeamSeason {
  const batting = sumSlashes(myTeamSlashes(games));
  let played = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let runsFor = 0;
  let runsAgainst = 0;
  let hitsFor = 0;
  let hitsAgainst = 0;
  let errors = 0;

  for (const game of games) {
    if (game.status !== "ended") continue;
    played += 1;
    const state = reduceGame(game);
    const mine = totalRuns(state.scores[game.mySide]);
    const theirs = totalRuns(state.scores[otherSide(game.mySide)]);
    if (mine > theirs) wins += 1;
    else if (mine < theirs) losses += 1;
    else draws += 1;
    runsFor += mine;
    runsAgainst += theirs;
    hitsFor += state.hits[game.mySide];
    hitsAgainst += state.hits[otherSide(game.mySide)];
    errors += state.errors[game.mySide];
  }

  return {
    played,
    wins,
    losses,
    draws,
    runsFor,
    runsAgainst,
    hitsFor,
    hitsAgainst,
    errors,
    batting,
  };
}
