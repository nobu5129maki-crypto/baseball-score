import { pickPlayerProfile } from "./player-profile";
import type { Game, LineupSlot, PitcherOnly, Player, Side } from "./types";

export type GameSetupInput = {
  opponentName: string;
  tournament: string;
  venue: string;
  date: string;
  mySide: Side;
  useDh: boolean;
  scheduledInnings: number;
};

const INNINGS = new Set([5, 6, 7, 9, 12]);

/** 打順準備中の試合だけ、先攻・日付などの条件を書き換える。始まっている試合は変えない。 */
export function applyGameSetup(game: Game, input: GameSetupInput, myPlayers: Player[] = []): Game {
  if (game.status !== "lineup" || game.events.length > 0) return game;

  let next: Game = {
    ...game,
    firstLineup: game.firstLineup.map((slot) => ({ ...slot })),
    secondLineup: game.secondLineup.map((slot) => ({ ...slot })),
  };

  if (input.mySide !== game.mySide) {
    next = {
      ...next,
      mySide: input.mySide,
      firstLineup: game.secondLineup.map((slot) => ({ ...slot })),
      secondLineup: game.firstLineup.map((slot) => ({ ...slot })),
      firstPitcher: game.secondPitcher ? { ...game.secondPitcher } : undefined,
      secondPitcher: game.firstPitcher ? { ...game.firstPitcher } : undefined,
    };
  }

  if (Boolean(input.useDh) !== Boolean(game.useDh)) {
    next = input.useDh ? enableDh(next, myPlayers) : disableDh(next);
  }

  const tournament = input.tournament.trim();
  const venue = input.venue.trim();
  next = {
    ...next,
    opponentName: input.opponentName.trim() || "相手",
    date: input.date || game.date,
    mySide: input.mySide,
    scheduledInnings: INNINGS.has(input.scheduledInnings) ? input.scheduledInnings : game.scheduledInnings,
    ...(tournament ? { tournament } : {}),
    ...(venue ? { venue } : {}),
  };
  if (!tournament) delete next.tournament;
  if (!venue) delete next.venue;
  if (!input.useDh) delete next.useDh;
  return next;
}

function enableDh(game: Game, myPlayers: Player[]): Game {
  const myKey = game.mySide === "first" ? "firstLineup" : "secondLineup";
  const oppKey = game.mySide === "first" ? "secondLineup" : "firstLineup";
  const used = new Set(game[myKey].map((slot) => slot.playerId));
  const spare = myPlayers.find((player) => !used.has(player.id));
  const mine = toDhLineup(game[myKey], spare ? slotFromPlayer(spare) : undefined, "my");
  const opp = toDhLineup(game[oppKey], undefined, "opp");
  const pitchers =
    game.mySide === "first"
      ? { firstPitcher: mine.pitcher, secondPitcher: opp.pitcher }
      : { firstPitcher: opp.pitcher, secondPitcher: mine.pitcher };
  return {
    ...game,
    useDh: true,
    [myKey]: mine.lineup,
    [oppKey]: opp.lineup,
    ...pitchers,
  };
}

function disableDh(game: Game): Game {
  const next: Game = {
    ...game,
    firstLineup: fromDhLineup(game.firstLineup, game.firstPitcher),
    secondLineup: fromDhLineup(game.secondLineup, game.secondPitcher),
  };
  delete next.useDh;
  delete next.firstPitcher;
  delete next.secondPitcher;
  return next;
}

function toDhLineup(
  slots: LineupSlot[],
  dh: LineupSlot | undefined,
  prefix: string,
): { lineup: LineupSlot[]; pitcher: PitcherOnly } {
  const index = Math.max(
    0,
    slots.findIndex((slot) => slot.position === "P"),
  );
  const current = slots[index];
  const batter: LineupSlot = dh
    ? { ...dh, order: current.order, position: "DH" }
    : {
        order: current.order,
        playerId: `dh-${prefix}-${current.playerId}`,
        playerName: "指名打者",
        position: "DH",
      };
  return {
    lineup: slots.map((slot, i) => (i === index ? batter : slot)),
    pitcher: toPitcher(current),
  };
}

function fromDhLineup(slots: LineupSlot[], pitcher: PitcherOnly | undefined): LineupSlot[] {
  const found = slots.findIndex((slot) => slot.position === "DH");
  const index = found >= 0 ? found : 0;
  return slots.map((slot, i) => {
    if (i !== index) return slot;
    if (!pitcher) return { ...slot, position: "P" };
    return {
      ...slot,
      position: "P",
      playerId: pitcher.playerId,
      playerName: pitcher.playerName,
      ...(pitcher.number ? { number: pitcher.number } : {}),
      ...pickPlayerProfile(pitcher),
    };
  });
}

function toPitcher(slot: LineupSlot): PitcherOnly {
  return {
    playerId: slot.playerId,
    playerName: slot.playerName,
    ...(slot.number ? { number: slot.number } : {}),
    ...pickPlayerProfile(slot),
  };
}

function slotFromPlayer(player: Player): LineupSlot {
  return {
    order: 0,
    playerId: player.id,
    playerName: player.name,
    ...(player.number ? { number: player.number } : {}),
    position: "DH",
    ...pickPlayerProfile(player),
  };
}
