import { newId } from "./ids";
import type {
  Base,
  BattedBall,
  DeliveredPitch,
  Dest,
  Game,
  GameEvent,
  GameState,
  Half,
  LineupSlot,
  PitcherOnly,
  PitchKind,
  PlayResult,
  Position,
  RunnerMove,
  RunnerOnBase,
  Side,
} from "./types";
import { stampEndTime } from "./game-time";
import { droppedThirdAllowed, isStrikeoutResult, needsField } from "./rules";
import { normalizeRunChangeAt } from "./run-change";
import { PITCHER_ORDER, SCOREBOARD_INNINGS } from "./types";

export function battingSide(half: Half): Side {
  return half === "top" ? "first" : "second";
}

export function fieldingSide(half: Half): Side {
  return half === "top" ? "second" : "first";
}

export function otherSide(side: Side): Side {
  return side === "first" ? "second" : "first";
}

export function emptyState(
  game: Pick<
    Game,
    | "scheduledInnings"
    | "firstLineup"
    | "secondLineup"
    | "useDh"
    | "firstPitcher"
    | "secondPitcher"
  >,
): GameState {
  const innings = Math.max(SCOREBOARD_INNINGS, game.scheduledInnings);
  return {
    inning: 1,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [null, null, null],
    lineupIndex: { first: 0, second: 0 },
    scores: {
      first: Array.from({ length: innings }, () => 0),
      second: Array.from({ length: innings }, () => 0),
    },
    hits: { first: 0, second: 0 },
    errors: { first: 0, second: 0 },
    pitchCountAtBat: 0,
    pitchesThrown: { first: 0, second: 0 },
    pitchesByPlayer: { first: {}, second: {} },
    useDh: Boolean(game.useDh),
    firstLineup: game.firstLineup.map((slot) => ({ ...slot })),
    secondLineup: game.secondLineup.map((slot) => ({ ...slot })),
    firstPitcher: game.firstPitcher ? { ...game.firstPitcher } : undefined,
    secondPitcher: game.secondPitcher ? { ...game.secondPitcher } : undefined,
    ended: false,
    regulationComplete: false,
    bottomUnplayed: false,
  };
}

export function reduceGame(game: Game): GameState {
  return game.events.reduce(
    (state, event) => applyEvent(game, state, event),
    emptyState(game),
  );
}

function dropRunChangeNotice(state: GameState): GameState {
  if (state.runChangeNotice == null) return state;
  const next = { ...state };
  delete next.runChangeNotice;
  return next;
}

export function getLineup(state: GameState, side: Side): LineupSlot[] {
  return side === "first" ? state.firstLineup : state.secondLineup;
}

export function getBatter(state: GameState): LineupSlot {
  const side = battingSide(state.half);
  const lineup = getLineup(state, side);
  const idx = state.lineupIndex[side];
  return lineup[idx] ?? lineup[0];
}

export function nextSeq(events: GameEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.seq), 0) + 1;
}

export function inningLabel(inning: number, half: Half): string {
  return `${inning}回${half === "top" ? "表" : "裏"}`;
}

export function totalRuns(scores: number[]): number {
  return scores.reduce((sum, n) => sum + n, 0);
}

export function getPitcherOnSide(state: GameState, side: Side): LineupSlot | undefined {
  if (state.useDh) {
    const pitcher = side === "first" ? state.firstPitcher : state.secondPitcher;
    if (!pitcher) return undefined;
    return { order: PITCHER_ORDER, position: "P", ...pitcher };
  }
  return getLineup(state, side).find((slot) => slot.position === "P");
}

export function getPitcher(state: GameState): LineupSlot | undefined {
  return getPitcherOnSide(state, fieldingSide(state.half));
}

export function getPitcherOnly(state: GameState, side: Side): PitcherOnly | undefined {
  if (!state.useDh) return undefined;
  return side === "first" ? state.firstPitcher : state.secondPitcher;
}

export function needsStrikeThreeChoice(state: GameState): boolean {
  return !state.ended && state.strikes >= 3;
}

export { playBlockedReason } from "./rules";

export function canDroppedThird(state: GameState): boolean {
  return droppedThirdAllowed(state);
}

export function playAddsPitch(result: PlayResult, state: Pick<GameState, "balls" | "strikes">): boolean {
  if (result === "walk") return state.balls < 4;
  if (isStrikeoutResult(result) || result === "dropped_third") return state.strikes < 3;
  return true;
}

export function nextStealBaseOpen(state: GameState, from: Base): boolean {
  if (from === 3) return true;
  return state.bases[from] == null;
}

export function needsFieldPosition(result: PlayResult): boolean {
  return needsField(result);
}

export function previewAfterMoves(
  state: GameState,
  moves: RunnerMove[],
  batter: LineupSlot,
): { bases: GameState["bases"]; scored: string[]; outs: string[] } {
  const names = runnerLookup(state, batter);
  const locations = new Map<string, 0 | Dest>();
  locations.set(batter.playerId, 0);
  state.bases.forEach((runner, index) => {
    if (runner) locations.set(runner.playerId, (index + 1) as Base);
  });
  for (const move of moves) locations.set(move.playerId, move.to);

  const bases: GameState["bases"] = [null, null, null];
  const scored: string[] = [];
  const outs: string[] = [];
  for (const [playerId, loc] of locations) {
    const info = names.get(playerId);
    const name = info?.playerName ?? "走者";
    if (loc === "out") {
      outs.push(name);
      continue;
    }
    if (loc === 0) continue;
    if (loc === 4) {
      scored.push(name);
      continue;
    }
    bases[loc - 1] = info ?? { playerId, playerName: name, battingOrder: 0 };
  }
  return { bases, scored, outs };
}

export function needsRunnerConfirm(result: PlayResult, state: GameState): boolean {
  if (isStrikeoutResult(result)) return false;
  if (result === "homerun") return false;
  const hasRunner = state.bases.some(Boolean);
  if (hasRunner) return true;
  if (
    result === "groundout" ||
    result === "flyout" ||
    result === "lineout" ||
    result === "walk" ||
    result === "hbp" ||
    result === "dropped_third"
  ) {
    return false;
  }
  return false;
}

export function proposeMoves(
  result: PlayResult,
  state: GameState,
  batter: LineupSlot,
): RunnerMove[] {
  const r3 = state.bases[2];
  const batterMove = (to: Dest): RunnerMove => ({
    playerId: batter.playerId,
    from: 0,
    to,
  });

  switch (result) {
    case "single":
    case "error":
    case "fielders_choice":
      return [batterMove(1), ...plus(state.bases, 1)];
    case "double":
      return [batterMove(2), ...plus(state.bases, 2)];
    case "triple":
      return [batterMove(3), ...plus(state.bases, 3)];
    case "homerun":
      return [batterMove(4), ...plus(state.bases, 4)];
    case "walk":
    case "hbp":
    case "dropped_third":
    case "catcher_interference":
      return forceWalk(batter.playerId, state.bases);
    case "strikeout":
    case "strikeout_looking":
    case "strikeout_swinging":
    case "groundout":
    case "flyout":
    case "lineout":
    case "offensive_interference":
      return [batterMove("out")];
    case "preceding_out":
      return [];
    case "gidp": {
      const force = ([1, 2, 3] as const).find((base) => state.bases[base - 1]);
      return [
        batterMove("out"),
        ...(force
          ? [{ playerId: state.bases[force - 1]!.playerId, from: force, to: "out" as const }]
          : []),
      ];
    }
    case "sac_bunt":
      return [batterMove("out"), ...plus(state.bases, 1)];
    case "sac_fly":
      return [
        batterMove("out"),
        ...(r3
          ? [{ playerId: r3.playerId, from: 3 as const, to: 4 as const }]
          : []),
      ];
    case "runner_hit": {
      const hit = ([1, 2, 3] as const).find((base) => state.bases[base - 1]);
      if (!hit) return [batterMove(1)];
      return proposeRunnerHit(state, batter, hit);
    }
  }
}

/** 打球がベンチに入ったボールデッド。打者は1塁、いる走者はそれぞれ1つ進む。 */
export function proposeDeadBall(state: GameState, batter: LineupSlot): RunnerMove[] {
  return proposeMoves("error", state, batter);
}

/** 送球がベンチに入ったボールデッド。いる走者だけがそれぞれ1つ進む。 */
export function proposeBench(state: GameState): RunnerMove[] {
  return plus(state.bases, 1);
}

/**
 * 守備妨害。打者なら打者アウトで走者は残す。
 * 走者ならその走者がアウト。2アウト未満なら打者は1塁、詰まっている走者だけ進む。
 * すでに2アウトなら、その走者で3アウトになり打者は出塁しない。
 */
export function proposeOffensiveInterference(
  state: GameState,
  batter: LineupSlot,
  who: "batter" | Base,
): RunnerMove[] {
  if (who === "batter") {
    return [{ playerId: batter.playerId, from: 0, to: "out" }];
  }
  const runner = state.bases[who - 1];
  if (!runner) return [{ playerId: batter.playerId, from: 0, to: "out" }];
  const runnerOut: RunnerMove = { playerId: runner.playerId, from: who, to: "out" };
  if (state.outs >= 2) return [runnerOut];
  const remaining: GameState["bases"] = [state.bases[0], state.bases[1], state.bases[2]];
  remaining[who - 1] = null;
  return [runnerOut, ...forceWalk(batter.playerId, remaining)];
}

/**
 * 安打または野選のまま、指定した走者だけを挟殺でアウトにする。
 * 打者の安打は結果のとおり残し、その走者の進塁だけをアウトに変える。
 */
export function proposeRundown(
  result: "single" | "double" | "triple" | "fielders_choice",
  state: GameState,
  batter: LineupSlot,
  outBase: Base,
): RunnerMove[] {
  const runner = state.bases[outBase - 1];
  const moves = proposeMoves(result, state, batter);
  if (!runner) return moves;
  let replaced = false;
  const next = moves.map((move) => {
    if (move.playerId !== runner.playerId) return move;
    replaced = true;
    return { playerId: runner.playerId, from: outBase, to: "out" as const };
  });
  if (!replaced) next.push({ playerId: runner.playerId, from: outBase, to: "out" });
  return next;
}

/** 打者が一塁に達する前の3アウト。選んだ走者だけアウトにし、打者は出塁しない。 */
export function proposePrecedingOut(state: GameState, outBase: Base): RunnerMove[] {
  const runner = state.bases[outBase - 1];
  if (!runner) return [];
  return [{ playerId: runner.playerId, from: outBase, to: "out" }];
}

export function proposeRunnerHit(
  state: GameState,
  batter: LineupSlot,
  hitBase: Base,
): RunnerMove[] {
  const hitRunner = state.bases[hitBase - 1];
  if (!hitRunner) {
    return [{ playerId: batter.playerId, from: 0, to: 1 }];
  }
  const remaining: GameState["bases"] = [...state.bases];
  remaining[hitBase - 1] = null;
  return [
    { playerId: batter.playerId, from: 0, to: 1 },
    { playerId: hitRunner.playerId, from: hitBase, to: "out" },
    ...forceWalk(batter.playerId, remaining).filter((m) => m.playerId !== batter.playerId),
  ];
}

function plus(bases: GameState["bases"], steps: number): RunnerMove[] {
  const moves: RunnerMove[] = [];
  ([3, 2, 1] as const).forEach((base) => {
    const runner = bases[base - 1];
    if (!runner) return;
    const dest = Math.min(4, base + steps) as Dest;
    moves.push({ playerId: runner.playerId, from: base, to: dest });
  });
  return moves;
}

/** 一塁と三塁に走者がいるとき、一塁だけ残す暴投・捕逸。それ以外は全員が1つ進む。 */
export function wildPitchMoves(bases: GameState["bases"], holdFirst: boolean): RunnerMove[] {
  const advance = plus(bases, 1);
  if (!holdFirst || !bases[0] || !bases[2]) return advance;
  return advance.filter((move) => move.from !== 1);
}

function forceWalk(batterId: string, bases: GameState["bases"]): RunnerMove[] {
  const moves: RunnerMove[] = [{ playerId: batterId, from: 0, to: 1 }];
  const r1 = bases[0];
  const r2 = bases[1];
  const r3 = bases[2];
  if (r1) {
    moves.push({ playerId: r1.playerId, from: 1, to: 2 });
    if (r2) {
      moves.push({ playerId: r2.playerId, from: 2, to: 3 });
      if (r3) {
        moves.push({ playerId: r3.playerId, from: 3, to: 4 });
      }
    }
  }
  return moves;
}

function applyEvent(game: Game, state: GameState, event: GameEvent): GameState {
  if (state.ended && event.t !== "end_game") return state;
  const current = dropRunChangeNotice(state);
  switch (event.t) {
    case "pitch":
      return applyPitch(current, event.kind);
    case "play":
      return applyOccupancy(game, current, event.moves, {
        consumeAtBat: event.result !== "preceding_out",
        result: event.result,
      });
    case "steal":
      return applySteal(game, current, event.from, event.to);
    case "pickoff":
      return applySteal(game, current, event.from, "out");
    case "wp":
    case "pb":
      return applyOccupancy(
        game,
        current,
        event.moves ?? wildPitchMoves(current.bases, event.holdFirst === true),
        { consumeAtBat: false },
      );
    case "bk":
      return applyOccupancy(game, current, plus(current.bases, 1), {
        consumeAtBat: false,
      });
    case "bench":
      return applyOccupancy(game, current, event.moves, {
        consumeAtBat: false,
        chargeError: true,
      });
    case "sub":
      return applySub(
        current,
        event.side,
        event.order,
        event.playerId,
        event.playerName,
        event.position,
        event.number,
      );
    case "pr":
      return applyPinchRunner(
        current,
        event.base,
        event.playerId,
        event.playerName,
        event.position,
        event.number,
      );
    case "end_game":
      return { ...current, ended: true };
  }
}

function applyPitch(state: GameState, kind: PitchKind): GameState {
  let { balls, strikes } = state;
  if (kind === "ball") balls += 1;
  else if (kind === "strike") strikes += 1;
  else if (kind === "foul" && strikes < 2) strikes += 1;

  return {
    ...state,
    ...countPitch(state, fieldingSide(state.half)),
    balls,
    strikes,
    pitchCountAtBat: state.pitchCountAtBat + 1,
  };
}

function countPitch(
  state: GameState,
  side: Side,
): Pick<GameState, "pitchesThrown" | "pitchesByPlayer"> {
  const pitchesThrown = { ...state.pitchesThrown, [side]: state.pitchesThrown[side] + 1 };
  const pitcherId = getPitcherOnSide(state, side)?.playerId;
  if (!pitcherId) return { pitchesThrown, pitchesByPlayer: state.pitchesByPlayer };
  return {
    pitchesThrown,
    pitchesByPlayer: {
      ...state.pitchesByPlayer,
      [side]: { ...state.pitchesByPlayer[side], [pitcherId]: pitchesThrown[side] },
    },
  };
}

function pitchesOnChange(
  state: GameState,
  side: Side,
  oldPitcherId: string | undefined,
  newPitcherId: string | undefined,
): GameState["pitchesThrown"] {
  if (!newPitcherId || oldPitcherId === newPitcherId) return state.pitchesThrown;
  return { ...state.pitchesThrown, [side]: state.pitchesByPlayer[side][newPitcherId] ?? 0 };
}

function runnerLookup(state: GameState, batter: LineupSlot): Map<string, RunnerOnBase> {
  const map = new Map<string, RunnerOnBase>();
  map.set(batter.playerId, {
    playerId: batter.playerId,
    playerName: batter.playerName,
    battingOrder: batter.order,
  });
  for (const lineup of [state.firstLineup, state.secondLineup]) {
    for (const slot of lineup) {
      if (!map.has(slot.playerId)) {
        map.set(slot.playerId, {
          playerId: slot.playerId,
          playerName: slot.playerName,
          battingOrder: slot.order,
        });
      }
    }
  }
  for (const runner of state.bases) {
    if (runner) map.set(runner.playerId, runner);
  }
  return map;
}

function ensureInning(scores: GameState["scores"], inning: number): GameState["scores"] {
  const first = [...scores.first];
  const second = [...scores.second];
  while (first.length < inning) first.push(0);
  while (second.length < inning) second.push(0);
  return { first, second };
}

function applyOccupancy(
  game: Game,
  state: GameState,
  moves: RunnerMove[],
  opts: { consumeAtBat: boolean; result?: PlayResult; chargeError?: boolean },
): GameState {
  const side = battingSide(state.half);
  const batter = getBatter(state);
  const names = runnerLookup(state, batter);

  const locations = new Map<string, 0 | Dest>();
  locations.set(batter.playerId, 0);
  state.bases.forEach((runner, index) => {
    if (runner) locations.set(runner.playerId, (index + 1) as Base);
  });
  for (const move of moves) {
    locations.set(move.playerId, move.to);
  }

  let outs = state.outs;
  let runs = 0;
  const newBases: GameState["bases"] = [null, null, null];

  for (const [playerId, loc] of locations) {
    if (loc === "out") {
      outs += 1;
      continue;
    }
    if (loc === 0) continue;
    if (loc === 4) {
      runs += 1;
      continue;
    }
    newBases[loc - 1] = names.get(playerId) ?? {
      playerId,
      playerName: "走者",
      battingOrder: 0,
    };
  }

  const hits = { ...state.hits };
  const errors = { ...state.errors };
  const result = opts.result;
  if (
    result === "single" ||
    result === "double" ||
    result === "triple" ||
    result === "homerun" ||
    result === "runner_hit"
  ) {
    hits[side] += 1;
  }
  if (result === "error" || opts.chargeError) {
    errors[otherSide(side)] += 1;
  }

  const scores = ensureInning(state.scores, state.inning);
  scores[side] = [...scores[side]];
  scores[side][state.inning - 1] += runs;

  const lineupIndex = { ...state.lineupIndex };
  if (opts.consumeAtBat) {
    lineupIndex[side] = (lineupIndex[side] + 1) % 9;
  }

  const countThisPitch = Boolean(
    result && playAddsPitch(result, state) && (opts.consumeAtBat || result === "preceding_out"),
  );
  const pitchCount = countThisPitch
    ? countPitch(state, fieldingSide(state.half))
    : { pitchesThrown: state.pitchesThrown, pitchesByPlayer: state.pitchesByPlayer };

  const next: GameState = {
    ...state,
    ...pitchCount,
    outs,
    balls: opts.consumeAtBat ? 0 : state.balls,
    strikes: opts.consumeAtBat ? 0 : state.strikes,
    bases: newBases,
    hits,
    errors,
    scores,
    lineupIndex,
    pitchCountAtBat: opts.consumeAtBat ? 0 : state.pitchCountAtBat,
  };

  if (isWalkOff(next, game.scheduledInnings)) {
    return { ...next, ended: true, regulationComplete: true };
  }
  const halfRuns = next.scores[side][state.inning - 1] ?? 0;
  const runChangeAt = normalizeRunChangeAt(game.runChangeAt);
  if (outs >= 3) {
    return advanceHalf(next, game.scheduledInnings);
  }
  if (runChangeAt != null && halfRuns >= runChangeAt) {
    return { ...advanceHalf(next, game.scheduledInnings), runChangeNotice: halfRuns };
  }
  return next;
}

function isWalkOff(state: GameState, scheduledInnings: number): boolean {
  if (state.half !== "bottom") return false;
  if (state.inning < scheduledInnings) return false;
  return totalRuns(state.scores.second) > totalRuns(state.scores.first);
}

function advanceHalf(state: GameState, scheduledInnings: number): GameState {
  if (state.half === "top") {
    const homeAhead = totalRuns(state.scores.second) > totalRuns(state.scores.first);
    if (state.inning >= scheduledInnings && homeAhead) {
      return {
        ...state,
        half: "bottom",
        outs: 0,
        balls: 0,
        strikes: 0,
        bases: [null, null, null],
        pitchCountAtBat: 0,
        ended: true,
        regulationComplete: true,
        bottomUnplayed: true,
      };
    }
    return {
      ...state,
      half: "bottom",
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: [null, null, null],
      pitchCountAtBat: 0,
    };
  }

  const tied = totalRuns(state.scores.first) === totalRuns(state.scores.second);
  if (state.inning >= scheduledInnings && !tied) {
    return { ...state, ended: true, regulationComplete: true };
  }
  if (state.inning >= SCOREBOARD_INNINGS) {
    return { ...state, ended: true, regulationComplete: true };
  }

  const inning = state.inning + 1;
  return {
    ...state,
    inning,
    half: "top",
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [null, null, null],
    pitchCountAtBat: 0,
    scores: ensureInning(state.scores, inning),
    regulationComplete: state.inning >= scheduledInnings,
  };
}

function applySteal(game: Game, state: GameState, from: Base, to: Dest): GameState {
  const runner = state.bases[from - 1];
  if (!runner) return state;
  return applyOccupancy(
    game,
    state,
    [{ playerId: runner.playerId, from, to }],
    { consumeAtBat: false },
  );
}

function applySub(
  state: GameState,
  side: Side,
  order: number,
  playerId: string,
  playerName: string,
  position: Position,
  number?: string,
): GameState {
  if (state.useDh && (order === PITCHER_ORDER || position === "P")) {
    const oldPitcher = (side === "first" ? state.firstPitcher : state.secondPitcher)?.playerId;
    const nextPitcher: PitcherOnly = { playerId, playerName, number };
    const pitchesThrown = pitchesOnChange(state, side, oldPitcher, playerId);
    if (side === "first") {
      return { ...state, firstPitcher: nextPitcher, pitchesThrown };
    }
    return { ...state, secondPitcher: nextPitcher, pitchesThrown };
  }

  const current = getLineup(state, side);
  const nextPosition = state.useDh && position === "P" ? "DH" : position;
  const nextLineup = current.map((slot) => {
    if (slot.order !== order) return slot;
    const samePlayer = slot.playerId === playerId;
    if (samePlayer) {
      return {
        ...slot,
        playerId,
        playerName,
        position: nextPosition,
        number: number ?? slot.number,
      };
    }
    return { order: slot.order, playerId, playerName, position: nextPosition, number };
  });
  const oldPitcher = getPitcherOnSide(state, side)?.playerId;
  const newPitcher = nextLineup.find((slot) => slot.position === "P")?.playerId ?? oldPitcher;
  const pitchesThrown = state.useDh
    ? state.pitchesThrown
    : pitchesOnChange(state, side, oldPitcher, newPitcher);
  if (side === "first") {
    return { ...state, firstLineup: nextLineup, pitchesThrown };
  }
  return { ...state, secondLineup: nextLineup, pitchesThrown };
}

function applyPinchRunner(
  state: GameState,
  base: Base,
  playerId: string,
  playerName: string,
  position: Position,
  number?: string,
): GameState {
  const runner = state.bases[base - 1];
  if (!runner) return state;
  const side = battingSide(state.half);
  const next = applySub(state, side, runner.battingOrder, playerId, playerName, position, number);
  const bases: GameState["bases"] = [...next.bases];
  bases[base - 1] = {
    playerId,
    playerName,
    battingOrder: runner.battingOrder,
  };
  return { ...next, bases };
}

function isDeliveredRunner(event: GameEvent): boolean {
  return (event.t === "steal" || event.t === "wp" || event.t === "pb") && event.pitch != null;
}

export function undoLast(events: GameEvent[]): GameEvent[] {
  if (events.length === 0) return events;
  const last = events[events.length - 1];
  if (last.t === "play" && last.fromDelivery) {
    let i = events.length - 2;
    if (i >= 0 && isDeliveredRunner(events[i])) i -= 1;
    if (i >= 0 && events[i].t === "pitch") i -= 1;
    return events.slice(0, i + 1);
  }
  if (isDeliveredRunner(last)) {
    let i = events.length - 2;
    if (i >= 0 && events[i].t === "pitch") i -= 1;
    return events.slice(0, i + 1);
  }
  return events.slice(0, -1);
}

export function undoAtBat(events: GameEvent[]): GameEvent[] {
  if (events.length === 0) return events;
  const last = events[events.length - 1];
  if (last.t === "pitch") {
    let i = events.length - 1;
    while (i >= 0 && events[i].t === "pitch") i -= 1;
    return events.slice(0, i + 1);
  }
  if (last.t === "play") {
    let i = events.length - 2;
    if (last.fromDelivery && i >= 0 && isDeliveredRunner(events[i])) i -= 1;
    while (i >= 0 && events[i].t === "pitch") i -= 1;
    return events.slice(0, i + 1);
  }
  if (isDeliveredRunner(last)) {
    let i = events.length - 2;
    if (i >= 0 && events[i].t === "pitch") i -= 1;
    while (i >= 0 && events[i].t === "pitch") i -= 1;
    return events.slice(0, i + 1);
  }
  return events.slice(0, -1);
}

function touch(game: Game, events: GameEvent[], status?: Game["status"]): Game {
  return {
    ...game,
    events,
    status: status ?? game.status,
    updatedAt: Date.now(),
  };
}

function append(game: Game, event: DistributiveOmit<GameEvent, "id" | "seq">): Game {
  const full = { ...event, id: newId(), seq: nextSeq(game.events) } as GameEvent;
  return touch(game, [...game.events, full], "in_progress");
}

function commitEvent(game: Game, event: DistributiveOmit<GameEvent, "id" | "seq">): Game {
  if (reduceGame(game).ended) return game;
  const next = append(game, event);
  return reduceGame(next).ended ? { ...next, status: "ended" } : next;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

function appendPitchOnly(game: Game, kind: PitchKind): Game {
  const before = reduceGame(game);
  if (before.ended || before.strikes >= 3) return game;
  return append(game, { t: "pitch", kind });
}

export function commitPitch(game: Game, kind: PitchKind): Game {
  const next = appendPitchOnly(game, kind);
  if (next === game) return game;
  const state = reduceGame(next);
  if (state.balls >= 4) return commitPlay(next, "walk");
  return next;
}

export type DeliveryAction = "steal" | "cs" | "wp" | "pb";

/** 四球でその走者が進む先。押されないときは null */
function walkDestination(state: GameState, from: Base): Dest | null {
  const move = proposeMoves("walk", state, getBatter(state)).find((item) => item.from === from);
  return move?.to ?? null;
}

/** 四球では進まない走者だけ。暴投・捕逸の余分な進塁 */
function wildExtras(state: GameState, holdFirst: boolean): RunnerMove[] {
  const walkMoves = proposeMoves("walk", state, getBatter(state));
  return wildPitchMoves(state.bases, holdFirst).filter((move) => {
    const walked = walkMoves.find((item) => item.playerId === move.playerId);
    return !walked || walked.to !== move.to;
  });
}

export function deliveryNote(state: GameState, pitch: DeliveredPitch, action: DeliveryAction): string {
  const fourth = pitch === "ball" && state.balls >= 3;
  const third = pitch === "strike" && state.strikes >= 2;
  if (!fourth && !third) {
    if (pitch === "ball") {
      return `ボールが${state.balls + 1}になります。球数が1つ増えて、打席は続きます。`;
    }
    return `ストライクが${state.strikes + 1}になります。球数が1つ増えて、打席は続きます。`;
  }
  if (fourth) {
    if (action === "cs" && state.outs >= 2) {
      return "4つ目のボールです。盗塁死が3アウト目になるので、打者の四球はつきません。";
    }
    if (action === "steal") {
      return "4つ目のボールです。打者は四球になります。押されない走者の盗塁だけ、盗塁として残します。";
    }
    if (action === "cs") {
      return "4つ目のボールです。選んだ走者は盗塁死、打者は四球になります。";
    }
    if (wildExtras(state, false).length === 0) {
      return "4つ目のボールです。走者は四球で進むので、進塁は四球だけにします。";
    }
    return action === "wp"
      ? "4つ目のボールです。打者は四球、押されない走者は暴投で進みます。"
      : "4つ目のボールです。打者は四球、押されない走者は捕逸で進みます。";
  }
  if (action === "steal" || action === "cs") {
    if (state.outs >= 2) return "3ストライクです。2アウトなので三振で攻守交代し、盗塁は記録しません。";
    return action === "steal"
      ? "3ストライクです。盗塁を記録し、打者は三振になります。"
      : "3ストライクです。盗塁死を記録し、打者は三振になります。";
  }
  if (canDroppedThird(state)) {
    return action === "wp"
      ? "3ストライクを捕手が取れませんでした。振り逃げで、打者は1塁へ出ます。"
      : "3ストライクを捕手がこぼしました。振り逃げで、打者は1塁へ出ます。";
  }
  return "3ストライクです。振り逃げはできないので打者は三振、走者は進みます。";
}

function commitPitched(
  game: Game,
  pitch: DeliveredPitch,
  mode: "caught" | "wild",
  playRunner: (game: Game) => Game,
): Game {
  const before = reduceGame(game);
  if (before.ended || before.strikes >= 3) return game;
  const pitched = appendPitchOnly(game, pitch);
  const pitchedState = reduceGame(pitched);
  const fourthBall = pitchedState.balls >= 4;
  const thirdStrike = pitchedState.strikes >= 3;
  if (thirdStrike && mode === "caught" && before.outs >= 2) {
    return commitPlay(pitched, "strikeout", undefined, undefined, undefined, { fromDelivery: true });
  }
  const withRunner = playRunner(pitched);
  const after = reduceGame(withRunner);
  if (after.ended || after.outs >= 3) return withRunner;
  if (fourthBall) {
    return commitPlay(withRunner, "walk", undefined, undefined, undefined, { fromDelivery: true });
  }
  if (thirdStrike) {
    const result = mode === "wild" && canDroppedThird(before) ? "dropped_third" : "strikeout";
    return commitPlay(withRunner, result, undefined, undefined, undefined, { fromDelivery: true });
  }
  return withRunner;
}

export function commitPlay(
  game: Game,
  result: PlayResult,
  moves?: RunnerMove[],
  field?: Position,
  batted?: BattedBall,
  detail?: { deadBall?: boolean; fieldedBy?: Position; fromDelivery?: boolean },
): Game {
  const state = reduceGame(game);
  if (state.ended) return game;
  const batter = getBatter(state);
  const resolved = moves ?? (detail?.deadBall ? proposeDeadBall(state, batter) : proposeMoves(result, state, batter));
  return commitEvent(game, {
    t: "play",
    result,
    moves: resolved,
    field,
    ...(batted ? { batted } : {}),
    ...(detail?.deadBall ? { deadBall: true } : {}),
    ...(detail?.fieldedBy ? { fieldedBy: detail.fieldedBy } : {}),
    ...(detail?.fromDelivery ? { fromDelivery: true } : {}),
  });
}

/** 2アウトで捕った3ストライク。盗塁は記録せず、三振で攻守交代する */
export function commitDeliveredStrikeout(game: Game): Game {
  return commitPitched(game, "strike", "caught", (next) => next);
}

export function commitSteal(game: Game, from: Base, to: Dest, pitch?: DeliveredPitch): Game {
  if (!pitch) return commitEvent(game, { t: "steal", from, to });
  const before = reduceGame(game);
  const forcedWalk = pitch === "ball" && before.balls >= 3 && to !== "out" && walkDestination(before, from) === to;
  const inningEndsOnStrike = pitch === "strike" && before.strikes >= 2 && before.outs >= 2;
  return commitPitched(game, pitch, "caught", (next) =>
    forcedWalk || inningEndsOnStrike ? next : commitEvent(next, { t: "steal", from, to, pitch }),
  );
}

export function commitPickoff(game: Game, from: Base): Game {
  return commitEvent(game, { t: "pickoff", from });
}

export function commitWp(game: Game, options?: { holdFirst?: boolean; pitch?: DeliveredPitch }): Game {
  return commitWild(game, "wp", options);
}

export function commitPb(game: Game, options?: { holdFirst?: boolean; pitch?: DeliveredPitch }): Game {
  return commitWild(game, "pb", options);
}

function commitWild(
  game: Game,
  kind: "wp" | "pb",
  options?: { holdFirst?: boolean; pitch?: DeliveredPitch },
): Game {
  const holdFirst = options?.holdFirst === true;
  const pitch = options?.pitch;
  if (!pitch) {
    return commitEvent(game, { t: kind, ...(holdFirst ? { holdFirst: true } : {}) });
  }
  const before = reduceGame(game);
  const fourth = pitch === "ball" && before.balls >= 3;
  const extras = fourth ? wildExtras(before, holdFirst) : null;
  return commitPitched(game, pitch, "wild", (next) => {
    if (extras && extras.length === 0) return next;
    return commitEvent(next, {
      t: kind,
      pitch,
      ...(holdFirst ? { holdFirst: true } : {}),
      ...(extras ? { moves: extras } : {}),
    });
  });
}

export function commitBk(game: Game): Game {
  return commitEvent(game, { t: "bk" });
}

export function commitBench(game: Game, moves?: RunnerMove[]): Game {
  const state = reduceGame(game);
  if (state.ended || !state.bases.some(Boolean)) return game;
  const resolved = moves ?? proposeBench(state);
  if (resolved.length === 0) return game;
  return commitEvent(game, { t: "bench", moves: resolved });
}

export function commitSub(
  game: Game,
  side: Side,
  order: number,
  playerId: string,
  playerName: string,
  position: Position,
  number?: string,
): Game {
  return commitEvent(game, { t: "sub", side, order, playerId, playerName, position, number });
}

export function commitPinchRunner(
  game: Game,
  base: Base,
  playerId: string,
  playerName: string,
  position: Position,
  number?: string,
): Game {
  return commitEvent(game, { t: "pr", base, playerId, playerName, position, number });
}

export function commitPinchHitter(
  game: Game,
  playerId: string,
  playerName: string,
  number?: string,
): Game {
  const state = reduceGame(game);
  const batter = getBatter(state);
  return commitSub(
    game,
    battingSide(state.half),
    batter.order,
    playerId,
    playerName,
    batter.position,
    number,
  );
}

export function commitPositionSwap(game: Game, side: Side, orderA: number, orderB: number): Game {
  if (orderA === orderB) return game;
  const state = reduceGame(game);
  const lineup = getLineup(state, side);
  const a = lineup.find((s) => s.order === orderA);
  const b = lineup.find((s) => s.order === orderB);
  if (!a || !b) return game;
  let next = commitSub(game, side, a.order, a.playerId, a.playerName, b.position);
  next = commitSub(next, side, b.order, b.playerId, b.playerName, a.position);
  return next;
}

export function commitEnd(game: Game, at = new Date()): Game {
  return { ...stampEndTime(append(game, { t: "end_game" }), at), status: "ended" };
}
