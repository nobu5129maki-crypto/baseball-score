import { db } from "./db";
import { newId } from "./ids";
import { pickPlayerProfile } from "./player-profile";
import { DH_LINEUP_POSITIONS, FIELD_POSITIONS } from "./types";
import type { LineupSlot, PitcherOnly, Player, Side } from "./types";

const SEED_PLAYERS = [
  { name: "佐藤", number: "1" },
  { name: "鈴木", number: "2" },
  { name: "高橋", number: "3" },
  { name: "田中", number: "4" },
  { name: "伊藤", number: "5" },
  { name: "渡辺", number: "6" },
  { name: "山本", number: "7" },
  { name: "中村", number: "8" },
  { name: "小林", number: "9" },
  { name: "加藤", number: "10" },
  { name: "吉田", number: "11" },
  { name: "山田", number: "12" },
];

let seedJob: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (!seedJob) seedJob = seedOnce();
  return seedJob;
}

async function seedOnce(): Promise<void> {
  const count = await db.teams.count();
  if (count > 0) return;
  const teamId = newId();
  await db.teams.add({
    id: teamId,
    name: "ひまわり",
    createdAt: Date.now(),
  });
  await db.players.bulkAdd(
    SEED_PLAYERS.map((p) => ({
      id: newId(),
      teamId,
      name: p.name,
      number: p.number,
      createdAt: Date.now(),
    })),
  );
  await db.settings.put({ id: "app", leftHanded: false });
}

export function lineupFromPlayers(players: Player[], useDh = false): LineupSlot[] {
  const positions = useDh ? DH_LINEUP_POSITIONS : FIELD_POSITIONS;
  return positions.map((position, i) => {
    const player = players[i];
    return {
      order: i + 1,
      playerId: player?.id ?? `vacant-${i + 1}`,
      playerName: player?.name ?? `選手${i + 1}`,
      number: player?.number,
      position,
      ...pickPlayerProfile(player),
    };
  });
}

/** DH制の打順外投手。打順9人の次の選手を充てる */
export function pitcherFromPlayers(players: Player[]): PitcherOnly {
  const player = players[9] ?? players[0];
  return {
    playerId: player?.id ?? "vacant-pitcher",
    playerName: player?.name ?? "投手",
    number: player?.number,
    ...pickPlayerProfile(player),
  };
}

export function opponentLineup(useDh = false): LineupSlot[] {
  const positions = useDh ? DH_LINEUP_POSITIONS : FIELD_POSITIONS;
  return positions.map((position, i) => ({
    order: i + 1,
    playerId: `opp-${newId().slice(0, 8)}-${i + 1}`,
    playerName: `相手${i + 1}`,
    position,
  }));
}

export function opponentPitcher(): PitcherOnly {
  return {
    playerId: `opp-${newId().slice(0, 8)}-p`,
    playerName: "相手投手",
  };
}

export function sidesFor(mySide: Side, mine: LineupSlot[], opponent: LineupSlot[]) {
  return mySide === "first"
    ? { firstLineup: mine, secondLineup: opponent }
    : { firstLineup: opponent, secondLineup: mine };
}

export function pitchersFor(
  mySide: Side,
  mine: PitcherOnly,
  opponent: PitcherOnly,
): { firstPitcher: PitcherOnly; secondPitcher: PitcherOnly } {
  return mySide === "first"
    ? { firstPitcher: mine, secondPitcher: opponent }
    : { firstPitcher: opponent, secondPitcher: mine };
}
