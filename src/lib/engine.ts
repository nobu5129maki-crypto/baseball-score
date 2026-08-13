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
  const innings = Math.max(1, game.scheduledInnings);
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

export function needsRunnerConfirm(result: PlayResult, state: GameState): boolean {
  if (
    result === "strikeout" ||
    result === "walk" ||
    result === "hbp" ||
    result === "homerun"
  ) {
    return false;
  }
  const hasRunner = state.bases.some(Boolean);
  if (
    !hasRunner &&
    (result === "groundout" || result === "flyout" || result === "lineout")
  ) {
    return false;
  }
  return true;
}

export function proposeMoves(
  result: PlayResult,
  state: GameState,
  batter: LineupSlot,
): RunnerMove[] {
  const r1 = state.bases[0];
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
      return forceWalk(batter.playerId, state.bases);
    case "strikeout":
    case "groundout":
    case "flyout":
    case "lineout":
      return [batterMove("out")];
    case "gidp":
      return [
        batterMove("out"),
        ...(r1
          ? [{ playerId: r1.playerId, from: 1 as const, to: "out" as const }]
          : []),
      ];
    case "sac_bunt":
      return [batterMove("out"), ...plus(state.bases, 1)];
    case "sac_fly":
      return [
        batterMove("out"),
        ...(r3
          ? [{ playerId: r3.playerId, from: 3 as const, to: 4 as const }]
          : []),
      ];
  }
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
    case "wp":
    case "pb":
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
    result === "homerun"
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
    pitchCountAtBat: opts.consumeAtBat ? 0 : state.pitchCountAtBat,
  };

  if (outs >= 3) {
    next = advanceHalf(next, game.scheduledInnings);
  }
  return next;
}

function advanceHalf(state: GameState, scheduledInnings: number): GameState {
  if (state.half === "top") {
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
): GameState {
  const patch = (slots: LineupSlot[]) =>
    slots.map((slot) =>
      slot.order === order ? { ...slot, playerId, playerName, position } : slot,
    );
  if (side === "first") {
    return { ...state, firstLineup: patch(state.firstLineup) };
  }
  return { ...state, secondLineup: patch(state.secondLineup) };
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

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function commitPitch(game: Game, kind: PitchKind): Game {
  const next = append(game, { t: "pitch", kind });
  const state = reduceGame(next);
  if (state.balls >= 4) {
    return commitPlay(next, "walk");
  }
  if (state.strikes >= 3) {
    return commitPlay(next, "strikeout");
  }
  return next;
}

export function commitPlay(game: Game, result: PlayResult, moves?: RunnerMove[]): Game {
  const state = reduceGame(game);
  const batter = getBatter(state);
  const resolved = moves ?? proposeMoves(result, state, batter);
  return append(game, { t: "play", result, moves: resolved });
}

export function commitSteal(game: Game, from: Base, to: Dest): Game {
  return append(game, { t: "steal", from, to });
}

export function commitWp(game: Game): Game {
  return append(game, { t: "wp" });
}

export function commitPb(game: Game): Game {
  return append(game, { t: "pb" });
}

export function commitSub(
  game: Game,
  side: Side,
  order: number,
  playerId: string,
  playerName: string,
  position: Position,
): Game {
  return append(game, { t: "sub", side, order, playerId, playerName, position });
}

export function commitEnd(game: Game): Game {
  return { ...append(game, { t: "end_game" }), status: "ended" };
}
