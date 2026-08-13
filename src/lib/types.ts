export type Side = "first" | "second";
export type Half = "top" | "bottom";
export type Base = 1 | 2 | 3;
export type Dest = 1 | 2 | 3 | 4 | "out";

export type Position =
  | "P"
  | "C"
  | "1B"
  | "2B"
  | "3B"
  | "SS"
  | "LF"
  | "CF"
  | "RF";

export const POSITIONS: Position[] = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
];

export const POSITION_LABELS: Record<Position, string> = {
  P: "ピッチャー",
  C: "キャッチャー",
  "1B": "ファースト",
  "2B": "セカンド",
  "3B": "サード",
  SS: "ショート",
  LF: "レフト",
  CF: "センター",
  RF: "ライト",
};

export type PitchKind = "ball" | "strike" | "foul";

export type PlayResult =
  | "single"
  | "double"
  | "triple"
  | "homerun"
  | "strikeout"
  | "walk"
  | "hbp"
  | "groundout"
  | "flyout"
  | "lineout"
  | "gidp"
  | "error"
  | "fielders_choice"
  | "sac_bunt"
  | "sac_fly";

export type RunnerMove = {
  playerId: string;
  from: 0 | 1 | 2 | 3;
  to: Dest;
};

export type PitchEvent = {
  id: string;
  seq: number;
  t: "pitch";
  kind: PitchKind;
};

export type PlayEvent = {
  id: string;
  seq: number;
  t: "play";
  result: PlayResult;
  moves: RunnerMove[];
};

export type StealEvent = {
  id: string;
  seq: number;
  t: "steal";
  from: Base;
  to: Dest;
};

export type WpEvent = { id: string; seq: number; t: "wp" };
export type PbEvent = { id: string; seq: number; t: "pb" };

export type SubEvent = {
  id: string;
  seq: number;
  t: "sub";
  side: Side;
  order: number;
  playerId: string;
  playerName: string;
  position: Position;
};

export type EndEvent = { id: string; seq: number; t: "end_game" };

export type GameEvent =
  | PitchEvent
  | PlayEvent
  | StealEvent
  | WpEvent
  | PbEvent
  | SubEvent
  | EndEvent;

export type LineupSlot = {
  order: number;
  playerId: string;
  playerName: string;
  position: Position;
};

export type GameStatus = "lineup" | "in_progress" | "ended";

export type Game = {
  id: string;
  myTeamId: string;
  myTeamName: string;
  opponentName: string;
  mySide: Side;
  scheduledInnings: number;
  date: string;
  status: GameStatus;
  firstLineup: LineupSlot[];
  secondLineup: LineupSlot[];
  events: GameEvent[];
  createdAt: number;
  updatedAt: number;
};

export type Team = {
  id: string;
  name: string;
  createdAt: number;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  number: string;
  createdAt: number;
};

export type Settings = {
  id: "app";
  leftHanded: boolean;
};

export type RunnerOnBase = {
  playerId: string;
  playerName: string;
  battingOrder: number;
};

export type GameState = {
  inning: number;
  half: Half;
  outs: number;
  balls: number;
  strikes: number;
  bases: [RunnerOnBase | null, RunnerOnBase | null, RunnerOnBase | null];
  lineupIndex: { first: number; second: number };
  scores: { first: number[]; second: number[] };
  hits: { first: number; second: number };
  errors: { first: number; second: number };
  pitchCountAtBat: number;
  pitchesThrown: { first: number; second: number };
  firstLineup: LineupSlot[];
  secondLineup: LineupSlot[];
  ended: boolean;
  regulationComplete: boolean;
};

export type AppSettings = Settings;
