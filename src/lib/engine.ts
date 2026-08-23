import { newId } from "./ids";
import type {
  Base,
  Dest,
  Game,
  GameEvent,
  GameState,
  Half,
  LineupSlot,
  PitchKind,
  PlayResult,
  Position,
  RunnerMove,
  RunnerOnBase,
  Side,
} from "./types";
import { stampEndTime } from "./game-time";
import { droppedThirdAllowed, needsField } from "./rules";
import { SCOREBOARD_INNINGS } from "./types";

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
  game: Pick<Game, "scheduledInnings" | "firstLineup" | "secondLineup">,
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
    firstLineup: game.firstLineup.map((slot) => ({ ...slot })),
    secondLineup: game.secondLineup.map((slot) => ({ ...slot })),
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

export function getPitcher(state: GameState): LineupSlot | undefined {
  const side = fieldingSide(state.half);
  return getLineup(state, side).find((slot) => slot.position === "P");
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
  if (result === "strikeout" || result === "dropped_third") return state.strikes < 3;
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
  if (result === "strikeout") return false;
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
      return forceWalk(batter.playerId, state.bases);
    case "strikeout":
    case "groundout":
    case "flyout":
    case "lineout":
      return [batterMove("out")];
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
  switch (event.t) {
    case "pitch":
      return applyPitch(state, event.kind);
    case "play":
      return applyOccupancy(game, state, event.moves, {
        consumeAtBat: true,
        result: event.result,
      });
    case "steal":
      return applySteal(game, state, event.from, event.to);
    case "pickoff":
      return applySteal(game, state, event.from, "out");
    case "wp":
    case "pb":
    case "bk":
      return applyOccupancy(game, state, plus(state.bases, 1), {
        consumeAtBat: false,
      });
    case "sub":
      return applySub(
        state,
        event.side,
        event.order,
        event.playerId,
        event.playerName,
        event.position,
        event.number,
      );
    case "pr":
      return applyPinchRunner(
        state,
        event.base,
        event.playerId,
        event.playerName,
        event.position,
        event.number,
      );
    case "end_game":
      return { ...state, ended: true };
  }
}

function applyPitch(state: GameState, kind: PitchKind): GameState {
  let { balls, strikes } = state;
  if (kind === "ball") balls += 1;
  else if (kind === "strike") strikes += 1;
  else if (kind === "foul" && strikes < 2) strikes += 1;

  const fielding = fieldingSide(state.half);
  return {
    ...state,
    balls,
    strikes,
    pitchCountAtBat: state.pitchCountAtBat + 1,
    pitchesThrown: {
      ...state.pitchesThrown,
      [fielding]: state.pitchesThrown[fielding] + 1,
    },
  };
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
  opts: { consumeAtBat: boolean; result?: PlayResult },
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
  if (result === "error") {
    errors[otherSide(side)] += 1;
  }

  const scores = ensureInning(state.scores, state.inning);
  scores[side] = [...scores[side]];
  scores[side][state.inning - 1] += runs;

  const lineupIndex = { ...state.lineupIndex };
  if (opts.consumeAtBat) {
    lineupIndex[side] = (lineupIndex[side] + 1) % 9;
  }

  const fielding = fieldingSide(state.half);
  let pitchesThrown = state.pitchesThrown;
  if (opts.consumeAtBat && result && playAddsPitch(result, state)) {
    pitchesThrown = {
      ...pitchesThrown,
      [fielding]: pitchesThrown[fielding] + 1,
    };
  }

  let next: GameState = {
    ...state,
    outs,
    balls: opts.consumeAtBat ? 0 : state.balls,
    strikes: opts.consumeAtBat ? 0 : state.strikes,
    bases: newBases,
    hits,
    errors,
    scores,
    lineupIndex,
    pitchesThrown,
    pitchCountAtBat: opts.consumeAtBat ? 0 : state.pitchCountAtBat,
  };

  if (isWalkOff(next, game.scheduledInnings)) {
    return { ...next, ended: true, regulationComplete: true };
  }
  if (outs >= 3) {
    next = advanceHalf(next, game.scheduledInnings);
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
  const current = getLineup(state, side);
  const nextLineup = current.map((slot) => {
    if (slot.order !== order) return slot;
    const samePlayer = slot.playerId === playerId;
    if (samePlayer) {
      return {
        ...slot,
        playerId,
        playerName,
        position,
        number: number ?? slot.number,
      };
    }
    return { order: slot.order, playerId, playerName, position, number };
  });
  const oldPitcher = current.find((slot) => slot.position === "P")?.playerId;
  const newPitcher = nextLineup.find((slot) => slot.position === "P")?.playerId;
  const pitchesThrown =
    oldPitcher !== newPitcher
      ? { ...state.pitchesThrown, [side]: 0 }
      : state.pitchesThrown;
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

export function undoLast(events: GameEvent[]): GameEvent[] {
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

export function commitPitch(game: Game, kind: PitchKind): Game {
  const before = reduceGame(game);
  if (before.ended || before.strikes >= 3) return game;
  const next = append(game, { t: "pitch", kind });
  const state = reduceGame(next);
  if (state.balls >= 4) {
    return commitPlay(next, "walk");
  }
  return next;
}

export function commitPlay(
  game: Game,
  result: PlayResult,
  moves?: RunnerMove[],
  field?: Position,
): Game {
  const state = reduceGame(game);
  if (state.ended) return game;
  const batter = getBatter(state);
  const resolved = moves ?? proposeMoves(result, state, batter);
  return commitEvent(game, { t: "play", result, moves: resolved, field });
}

export function commitSteal(game: Game, from: Base, to: Dest): Game {
  return commitEvent(game, { t: "steal", from, to });
}

export function commitPickoff(game: Game, from: Base): Game {
  return commitEvent(game, { t: "pickoff", from });
}

export function commitWp(game: Game): Game {
  return commitEvent(game, { t: "wp" });
}

export function commitPb(game: Game): Game {
  return commitEvent(game, { t: "pb" });
}

export function commitBk(game: Game): Game {
  return commitEvent(game, { t: "bk" });
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
