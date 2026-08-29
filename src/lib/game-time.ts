import type { Game } from "./types";

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export type GameTimes = Pick<Game, "startTime" | "endTime">;

export function normalizeTime(raw: string | undefined): string | undefined {
  const text = raw?.trim() ?? "";
  if (!text) return undefined;
  const match = TIME.exec(text);
  if (!match) return undefined;
  return `${match[1]}:${match[2]}`;
}

export function clockTime(at = new Date()): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`;
}

export function timeToParts(raw: string | undefined): { hour: string; minute: string } {
  const time = normalizeTime(raw);
  if (!time) return { hour: "", minute: "" };
  const [hour, minute] = time.split(":");
  return { hour, minute };
}

export function partsToTime(hourRaw: string, minuteRaw: string): string | undefined {
  const hour = hourRaw.trim();
  const minute = minuteRaw.trim();
  if (!hour && !minute) return undefined;
  if (!/^\d{1,2}$/.test(hour) || !/^\d{1,2}$/.test(minute)) return undefined;
  const h = Number(hour);
  const m = Number(minute);
  if (h > 23 || m > 59) return undefined;
  return `${pad(h)}:${pad(m)}`;
}

export function applyGameTimes(game: Game, times: GameTimes): Game {
  const next: Game = { ...game };
  const startTime = normalizeTime(times.startTime);
  const endTime = normalizeTime(times.endTime);
  if (startTime) next.startTime = startTime;
  else delete next.startTime;
  if (endTime) next.endTime = endTime;
  else delete next.endTime;
  return next;
}

export function stampStartTime(game: Game, at = new Date()): Game {
  if (normalizeTime(game.startTime)) return game;
  return { ...game, startTime: clockTime(at) };
}

export function stampEndTime(game: Game, at = new Date()): Game {
  if (normalizeTime(game.endTime)) return game;
  return { ...game, endTime: clockTime(at) };
}

export function minutesBetween(start: string, end: string): number | undefined {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from == null || to == null) return undefined;
  return (to - from + 24 * 60) % (24 * 60);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}分`;
  if (rest === 0) return `${hours}時間`;
  return `${hours}時間${rest}分`;
}

export function gameTimeLabel(game: GameTimes): string {
  const start = normalizeTime(game.startTime);
  const end = normalizeTime(game.endTime);
  if (start && end) {
    const duration = minutesBetween(start, end);
    const extra = duration != null ? `（${formatDuration(duration)}）` : "";
    return `${start}〜${end}${extra}`;
  }
  if (start) return `${start}開始`;
  if (end) return `${end}終了`;
  return "";
}

function toMinutes(raw: string): number | undefined {
  const time = normalizeTime(raw);
  if (!time) return undefined;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
