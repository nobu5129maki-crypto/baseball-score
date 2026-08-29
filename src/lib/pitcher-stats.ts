import {
  battingSide,
  fieldingSide,
  getLineup,
  otherSide,
  playAddsPitch,
  reduceGame,
  totalRuns,
} from "./engine";
import type { Game, GameState, LineupSlot, PlayEvent, PlayResult, Side } from "./types";

export type PitcherGameStats = {
  playerId: string;
  name: string;
  side: Side;
  year: number;
  games: number;
  wins: number;
  losses: number;
  saves: number;
  outs: number;
  bb: number;
  so: number;
  er: number;
  pitches: number;
  strikes: number;
  whiffs: number;
  hits: number;
  hr: number;
  groundBalls: number;
  flyBalls: number;
  lineBalls: number;
};

export type PitcherSortKey =
  | "name"
  | "year"
  | "games"
  | "wins"
  | "losses"
  | "saves"
  | "ip"
  | "bb"
  | "so"
  | "er"
  | "era"
  | "pitches"
  | "strikeRate"
  | "whiffRate"
  | "hits"
  | "hr"
  | "gbRate"
  | "fbRate";

export type SortDir = "asc" | "desc";

type RunnerCharge = {
  playerId: string;
  pitcherId: string;
  earned: boolean;
};

type EntryContext = {
  lead: number;
  runners: number;
};

type Mutable = {
  playerId: string;
  name: string;
  side: Side;
  year: number;
  outs: number;
  bb: number;
  so: number;
  er: number;
  pitches: number;
  strikes: number;
  whiffs: number;
  hits: number;
  hr: number;
  groundBalls: number;
  flyBalls: number;
  lineBalls: number;
  appeared: boolean;
  finished: boolean;
  entry: EntryContext | null;
};

function pitcherOnSide(state: GameState, side: Side): LineupSlot | undefined {
  return getLineup(state, side).find((slot) => slot.position === "P");
}

function gameYear(game: Game): number {
  const y = Number(game.date.slice(0, 4));
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function countOuts(moves: PlayEvent["moves"]): number {
  return moves.filter((m) => m.to === "out").length;
}

function isHit(result: PlayResult): boolean {
  return (
    result === "single" ||
    result === "double" ||
    result === "triple" ||
    result === "homerun" ||
    result === "runner_hit"
  );
}

/** 7回制は4回、9回制は5回（アウト数） */
export function starterWinOuts(scheduledInnings: number): number {
  return scheduledInnings <= 7 ? 12 : 15;
}

function tyingRunSave(lead: number, runners: number): boolean {
  return lead > 0 && lead <= runners + 2;
}

function emptyRow(playerId: string, name: string, side: Side, year: number): Mutable {
  return {
    playerId,
    name,
    side,
    year,
    outs: 0,
    bb: 0,
    so: 0,
    er: 0,
    pitches: 0,
    strikes: 0,
    whiffs: 0,
    hits: 0,
    hr: 0,
    groundBalls: 0,
    flyBalls: 0,
    lineBalls: 0,
    appeared: false,
    finished: false,
    entry: null,
  };
}

function leadSide(first: number, second: number): Side | null {
  if (first === second) return null;
  return first > second ? "first" : "second";
}

/**
 * 1試合の投手成績。
 * 勝敗・セーブ・自責は公認野球規則の考え方に沿った実用実装。
 */
export function gamePitcherStats(game: Game): PitcherGameStats[] {
  const year = gameYear(game);
  const map = new Map<string, Mutable>();

  const ensure = (slot: LineupSlot, side: Side): Mutable => {
    const key = `${side}:${slot.playerId}`;
    const existing = map.get(key);
    if (existing) {
      existing.name = slot.playerName;
      return existing;
    }
    const row = emptyRow(slot.playerId, slot.playerName, side, year);
    map.set(key, row);
    return row;
  };

  let cursor: Game = { ...game, events: [] };
  let before = reduceGame(cursor);

  for (const side of ["first", "second"] as Side[]) {
    const starter = pitcherOnSide(before, side);
    if (starter) ensure(starter, side);
  }

  // 各チームの「リードを奪った／許した時点」の責任投手
  const record: { first: string | null; second: string | null } = {
    first: pitcherOnSide(before, "first")?.playerId ?? null,
    second: pitcherOnSide(before, "second")?.playerId ?? null,
  };
  let finalLeadChange: { winningSide: Side; winPitcherId: string; losePitcherId: string | null } | null =
    null;

  let charges: RunnerCharge[] = [];
  let reconOuts = 0;
  let halfKey = `${before.inning}-${before.half}`;

  const clearHalf = (state: GameState) => {
    charges = [];
    reconOuts = 0;
    halfKey = `${state.inning}-${state.half}`;
  };

  const appear = (row: Mutable, state: GameState, side: Side) => {
    if (row.appeared) return;
    row.appeared = true;
    const mine = totalRuns(state.scores[side]);
    const theirs = totalRuns(state.scores[otherSide(side)]);
    row.entry = {
      lead: mine - theirs,
      runners: state.bases.filter(Boolean).length,
    };
  };

  const addPitch = (row: Mutable, kind: "ball" | "strike" | "foul" | "inplay") => {
    row.pitches += 1;
    if (kind === "ball") return;
    row.strikes += 1;
    if (kind === "strike") row.whiffs += 1;
  };

  for (const event of game.events) {
    before = reduceGame(cursor);
    if (`${before.inning}-${before.half}` !== halfKey) clearHalf(before);

    const fielding = fieldingSide(before.half);
    const batting = battingSide(before.half);
    const pSlot = pitcherOnSide(before, fielding);
    const pRow = pSlot ? ensure(pSlot, fielding) : undefined;

    if (event.t === "pitch" && pRow) {
      appear(pRow, before, fielding);
      addPitch(pRow, event.kind);
    }

    if (event.t === "play" && pRow) {
      const play = event;
      const reconBefore = reconOuts;

      if (playAddsPitch(play.result, before)) {
        appear(pRow, before, fielding);
        addPitch(pRow, "inplay");
      }

      if (play.result === "walk") pRow.bb += 1;
      if (play.result === "strikeout" || play.result === "dropped_third") pRow.so += 1;
      if (isHit(play.result)) {
        pRow.hits += 1;
        if (play.result === "homerun") pRow.hr += 1;
      }
      if (play.result === "groundout" || play.result === "gidp") pRow.groundBalls += 1;
      if (play.result === "flyout" || play.result === "sac_fly" || play.result === "homerun") {
        pRow.flyBalls += 1;
      }
      if (play.result === "lineout") pRow.lineBalls += 1;

      const outsMade = countOuts(play.moves);
      pRow.outs += outsMade;

      // 打者出塁の責任付け
      const batterMove = play.moves.find((m) => m.from === 0);
      if (batterMove && batterMove.to !== "out") {
        const earned = play.result !== "error";
        charges = charges.filter((c) => c.playerId !== batterMove.playerId);
        charges.push({
          playerId: batterMove.playerId,
          pitcherId: pRow.playerId,
          earned,
        });
      }

      // 得点 → 責任投手へ自責
      for (const move of play.moves) {
        if (move.to !== 4) continue;
        const charge = charges.find((c) => c.playerId === move.playerId);
        const pitcherId = charge?.pitcherId ?? pRow.playerId;
        let earned = charge?.earned ?? true;
        if (reconBefore >= 3) earned = false;
        const responsible = map.get(`${fielding}:${pitcherId}`);
        if (responsible && earned) responsible.er += 1;
      }

      reconOuts += outsMade;
      if (play.result === "error") reconOuts += 1;

      charges = charges.filter(
        (c) => !play.moves.some((m) => m.playerId === c.playerId && (m.to === 4 || m.to === "out")),
      );
    }

    if (event.t === "steal" && pRow && event.to === "out") {
      appear(pRow, before, fielding);
      pRow.outs += 1;
      reconOuts += 1;
      const runner = before.bases[event.from - 1];
      if (runner) charges = charges.filter((c) => c.playerId !== runner.playerId);
    }

    if (event.t === "pickoff" && pRow) {
      appear(pRow, before, fielding);
      pRow.outs += 1;
      reconOuts += 1;
      const runner = before.bases[event.from - 1];
      if (runner) charges = charges.filter((c) => c.playerId !== runner.playerId);
    }

    cursor = { ...cursor, events: [...cursor.events, event] };
    const after = reduceGame(cursor);

    // リード変化 → 勝敗候補更新
    const beforeLead = leadSide(totalRuns(before.scores.first), totalRuns(before.scores.second));
    const afterLead = leadSide(totalRuns(after.scores.first), totalRuns(after.scores.second));
    if (afterLead && afterLead !== beforeLead) {
      const winPitcherId = pitcherOnSide(after, afterLead)?.playerId ?? record[afterLead];
      if (winPitcherId) record[afterLead] = winPitcherId;
      // リードを許した側: 得点を献上した守備投手
      let losePitcherId = record[otherSide(afterLead)];
      if (batting === afterLead && pSlot) {
        losePitcherId = pSlot.playerId;
        record[otherSide(afterLead)] = pSlot.playerId;
      }
      finalLeadChange = {
        winningSide: afterLead,
        winPitcherId: winPitcherId ?? record[afterLead]!,
        losePitcherId,
      };
    } else if (!afterLead) {
      finalLeadChange = null;
    }

    // 投手交代時、未登場なら登場時状況を仮置き
    if (event.t === "sub") {
      for (const side of ["first", "second"] as Side[]) {
        const nextP = pitcherOnSide(after, side);
        const prevP = pitcherOnSide(before, side);
        if (!nextP || (prevP && prevP.playerId === nextP.playerId)) continue;
        const row = ensure(nextP, side);
        if (!row.appeared && !row.entry) {
          row.entry = {
            lead: totalRuns(after.scores[side]) - totalRuns(after.scores[otherSide(side)]),
            runners: after.bases.filter(Boolean).length,
          };
        }
      }
    }

    if (after.inning !== before.inning || after.half !== before.half) clearHalf(after);
  }

  const finalState = reduceGame(game);
  for (const side of ["first", "second"] as Side[]) {
    const finisher = pitcherOnSide(finalState, side);
    if (finisher) {
      const row = map.get(`${side}:${finisher.playerId}`);
      if (row) row.finished = true;
    }
  }

  const firstTotal = totalRuns(finalState.scores.first);
  const secondTotal = totalRuns(finalState.scores.second);
  const decided = game.status === "ended" && firstTotal !== secondTotal;
  const winSide: Side | null = decided ? (firstTotal > secondTotal ? "first" : "second") : null;
  const loseSide: Side | null = winSide ? otherSide(winSide) : null;

  let winPitcherId: string | null = null;
  let losePitcherId: string | null = null;

  if (winSide && finalLeadChange?.winningSide === winSide) {
    winPitcherId = finalLeadChange.winPitcherId;
    losePitcherId = finalLeadChange.losePitcherId;
    const winner = map.get(`${winSide}:${winPitcherId}`);
    const opening = pitcherOnSide(reduceGame({ ...game, events: [] }), winSide);
    if (
      winner &&
      opening?.playerId === winPitcherId &&
      winner.outs < starterWinOuts(game.scheduledInnings)
    ) {
      const relievers = [...map.values()]
        .filter((p) => p.side === winSide && p.playerId !== winPitcherId && p.appeared && p.outs > 0)
        .sort((a, b) => b.outs - a.outs || a.name.localeCompare(b.name, "ja"));
      winPitcherId = relievers[0]?.playerId ?? null;
    }
  } else if (loseSide) {
    losePitcherId = record[loseSide];
  }

  const rows: PitcherGameStats[] = [];
  for (const row of map.values()) {
    if (!row.appeared) continue;
    const wins = winSide === row.side && row.playerId === winPitcherId ? 1 : 0;
    const losses = loseSide === row.side && row.playerId === losePitcherId ? 1 : 0;
    let saves = 0;
    if (winSide === row.side && wins === 0 && row.finished && row.entry) {
      const finalLead =
        totalRuns(finalState.scores[row.side]) - totalRuns(finalState.scores[otherSide(row.side)]);
      if (game.status === "ended" && finalLead > 0) {
        const e = row.entry;
        if (row.outs >= 9) saves = 1;
        else if (e.lead >= 1 && e.lead <= 3 && row.outs >= 3) saves = 1;
        else if (tyingRunSave(e.lead, e.runners)) saves = 1;
      }
    }
    rows.push({
      playerId: row.playerId,
      name: row.name,
      side: row.side,
      year: row.year,
      games: 1,
      wins,
      losses,
      saves,
      outs: row.outs,
      bb: row.bb,
      so: row.so,
      er: row.er,
      pitches: row.pitches,
      strikes: row.strikes,
      whiffs: row.whiffs,
      hits: row.hits,
      hr: row.hr,
      groundBalls: row.groundBalls,
      flyBalls: row.flyBalls,
      lineBalls: row.lineBalls,
    });
  }
  return rows;
}

export function formatInnings(outs: number): string {
  const whole = Math.floor(Math.max(0, outs) / 3);
  const rem = Math.max(0, outs) % 3;
  if (rem === 0) return String(whole);
  return `${whole}.${rem}`;
}

export function eraValue(er: number, outs: number): number | null {
  if (outs <= 0) return null;
  return (er * 27) / outs;
}

export function formatEra(er: number, outs: number): string {
  const n = eraValue(er, outs);
  if (n == null) return "-";
  return n.toFixed(2);
}

export function rateValue(num: number, den: number): number | null {
  if (den <= 0) return null;
  return num / den;
}

export function formatRate(num: number, den: number): string {
  const n = rateValue(num, den);
  if (n == null) return "-";
  return `${(n * 100).toFixed(1)}%`;
}

function bipTotal(p: Pick<PitcherGameStats, "groundBalls" | "flyBalls" | "lineBalls">): number {
  return p.groundBalls + p.flyBalls + p.lineBalls;
}

export function pitcherSortValue(p: PitcherGameStats, key: PitcherSortKey): number | string | null {
  if (key === "name") return p.name;
  if (key === "year") return p.year;
  if (key === "games") return p.games;
  if (key === "wins") return p.wins;
  if (key === "losses") return p.losses;
  if (key === "saves") return p.saves;
  if (key === "ip") return p.outs;
  if (key === "bb") return p.bb;
  if (key === "so") return p.so;
  if (key === "er") return p.er;
  if (key === "era") return eraValue(p.er, p.outs);
  if (key === "pitches") return p.pitches;
  if (key === "strikeRate") return rateValue(p.strikes, p.pitches);
  if (key === "whiffRate") return rateValue(p.whiffs, p.pitches);
  if (key === "hits") return p.hits;
  if (key === "hr") return p.hr;
  if (key === "gbRate") return rateValue(p.groundBalls, bipTotal(p));
  if (key === "fbRate") return rateValue(p.flyBalls, bipTotal(p));
  return null;
}

export function comparePitchers(
  a: PitcherGameStats,
  b: PitcherGameStats,
  key: PitcherSortKey,
  dir: SortDir,
): number {
  const av = pitcherSortValue(a, key);
  const bv = pitcherSortValue(b, key);
  if (av == null && bv == null) return a.name.localeCompare(b.name, "ja");
  if (av == null) return 1;
  if (bv == null) return -1;
  let cmp = 0;
  if (typeof av === "string" && typeof bv === "string") cmp = av.localeCompare(bv, "ja");
  else cmp = (av as number) - (bv as number);
  if (cmp === 0) cmp = a.name.localeCompare(b.name, "ja") || b.year - a.year;
  return dir === "asc" ? cmp : -cmp;
}

function mergeRow(map: Map<string, PitcherGameStats>, row: PitcherGameStats) {
  const key = `${row.year}:${row.playerId}`;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...row });
    return;
  }
  prev.name = row.name;
  prev.games += row.games;
  prev.wins += row.wins;
  prev.losses += row.losses;
  prev.saves += row.saves;
  prev.outs += row.outs;
  prev.bb += row.bb;
  prev.so += row.so;
  prev.er += row.er;
  prev.pitches += row.pitches;
  prev.strikes += row.strikes;
  prev.whiffs += row.whiffs;
  prev.hits += row.hits;
  prev.hr += row.hr;
  prev.groundBalls += row.groundBalls;
  prev.flyBalls += row.flyBalls;
  prev.lineBalls += row.lineBalls;
}

export function myTeamPitcherStats(games: Game[]): PitcherGameStats[] {
  const map = new Map<string, PitcherGameStats>();
  for (const game of games) {
    for (const row of gamePitcherStats(game)) {
      if (row.side !== game.mySide) continue;
      mergeRow(map, row);
    }
  }
  return [...map.values()].sort(
    (a, b) => b.year - a.year || b.wins - a.wins || b.outs - a.outs || a.name.localeCompare(b.name, "ja"),
  );
}

export function pitcherPitchesFromGame(
  game: Game,
  side: Side,
): Array<{ playerId: string; name: string; pitches: number }> {
  return gamePitcherStats(game)
    .filter((p) => p.side === side)
    .map((p) => ({ playerId: p.playerId, name: p.name, pitches: p.pitches }));
}
