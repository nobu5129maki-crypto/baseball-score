import type { BatsSide, PlayerProfile, ThrowsHand } from "./types";

export const THROWS_OPTIONS: Array<{ value: ThrowsHand; label: string }> = [
  { value: "right", label: "右投げ" },
  { value: "left", label: "左投げ" },
];

export const BATS_OPTIONS: Array<{ value: BatsSide; label: string }> = [
  { value: "right", label: "右打ち" },
  { value: "left", label: "左打ち" },
  { value: "switch", label: "両打ち" },
];

export const GRADE_OPTIONS = [
  "小1",
  "小2",
  "小3",
  "小4",
  "小5",
  "小6",
  "中1",
  "中2",
  "中3",
  "高1",
  "高2",
  "高3",
] as const;

const THROWS_SHORT: Record<ThrowsHand, string> = {
  right: "右投",
  left: "左投",
};

const BATS_SHORT: Record<BatsSide, string> = {
  right: "右打",
  left: "左打",
  switch: "両打",
};

export function pickPlayerProfile(source: PlayerProfile | undefined | null): PlayerProfile {
  if (!source) return {};
  const next: PlayerProfile = {};
  if (source.throws) next.throws = source.throws;
  if (source.bats) next.bats = source.bats;
  if (source.ageKind) next.ageKind = source.ageKind;
  if (source.grade) next.grade = source.grade;
  if (typeof source.age === "number" && Number.isFinite(source.age)) next.age = source.age;
  return next;
}

export function compactPlayer(player: {
  id: string;
  teamId: string;
  name: string;
  number: string;
  kana?: string;
  createdAt: number;
} & PlayerProfile) {
  return {
    id: player.id,
    teamId: player.teamId,
    name: player.name,
    number: player.number,
    createdAt: player.createdAt,
    ...(player.kana ? { kana: player.kana } : {}),
    ...pickPlayerProfile(player),
  };
}

export function throwsBatsLabel(profile: PlayerProfile): string {
  if (profile.throws && profile.bats) return `${THROWS_SHORT[profile.throws]}${BATS_SHORT[profile.bats]}`;
  if (profile.throws) return THROWS_OPTIONS.find((o) => o.value === profile.throws)?.label ?? "";
  if (profile.bats) return BATS_OPTIONS.find((o) => o.value === profile.bats)?.label ?? "";
  return "";
}

export function ageLabel(profile: PlayerProfile): string {
  if (profile.ageKind === "grade" && profile.grade) return profile.grade;
  if (profile.ageKind === "age" && typeof profile.age === "number") return `${profile.age}歳`;
  if (profile.grade) return profile.grade;
  if (typeof profile.age === "number") return `${profile.age}歳`;
  return "";
}

export function playerProfileLabel(profile: PlayerProfile): string {
  return [throwsBatsLabel(profile), ageLabel(profile)].filter(Boolean).join(" · ");
}

export function parseAgeInput(raw: string): number | undefined {
  const n = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return undefined;
  return n;
}
