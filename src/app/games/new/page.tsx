"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { GameSetupForm, type GameSetupValues } from "@/components/GameSetupForm";
import { db, getSettings, loadPlayersOnTeam, saveGame, setActiveTeamId } from "@/lib/db";
import { newId } from "@/lib/ids";
import { localDateKey } from "@/lib/game-time";
import { normalizeRunChangeAt } from "@/lib/run-change";
import { recentOpponentNames, recentTournamentNames, recentVenueNames } from "@/lib/opponents";
import {
  lineupFromPlayers,
  opponentLineup,
  opponentPitcher,
  pitcherFromPlayers,
  pitchersFor,
  sidesFor,
} from "@/lib/seed";
import { resolveActiveTeam, sortOwnTeams, teamDisplayName } from "@/lib/teams";

/** 作成〜遷移のあいだ、再マウントしてもフォームを出さない */
let suppressForm = false;

export default function NewGamePage() {
  const router = useRouter();
  const teams = sortOwnTeams(useLiveQuery(() => db.teams.toArray()) ?? []);
  const settings = useLiveQuery(() => getSettings());
  const team = resolveActiveTeam(teams, settings?.activeTeamId);
  const players =
    useLiveQuery(() => (team ? loadPlayersOnTeam(team.id) : []), [team?.id]) ?? [];
  const games = useLiveQuery(() => db.games.toArray(), []) ?? [];
  const [leaving, setLeaving] = useState(() => suppressForm);
  const [error, setError] = useState("");
  const creating = useRef(false);
  const today = localDateKey();

  useEffect(() => {
    return () => {
      suppressForm = false;
    };
  }, []);

  async function create(values: GameSetupValues) {
    if (!team || creating.current || suppressForm) return;
    creating.current = true;
    suppressForm = true;
    setLeaving(true);
    setError("");
    try {
      const mine = lineupFromPlayers(players, values.useDh);
      const opp = opponentLineup(values.useDh);
      const sides = sidesFor(values.mySide, mine, opp);
      const pitchers = values.useDh
        ? pitchersFor(values.mySide, pitcherFromPlayers(players), opponentPitcher())
        : null;
      const id = newId();
      const meet = values.tournament.trim();
      const place = values.venue.trim();
      const runChangeAt = normalizeRunChangeAt(values.runChangeAt);
      await saveGame({
        id,
        myTeamId: team.id,
        myTeamName: team.name,
        opponentName: values.opponent.trim() || "相手",
        ...(meet ? { tournament: meet } : {}),
        ...(place ? { venue: place } : {}),
        mySide: values.mySide,
        ...(values.useDh ? { useDh: true, ...pitchers } : {}),
        scheduledInnings: values.innings,
        ...(runChangeAt ? { runChangeAt } : {}),
        date: values.date,
        status: "lineup",
        firstLineup: sides.firstLineup,
        secondLineup: sides.secondLineup,
        events: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      router.replace(`/games/${id}/lineup`);
    } catch (err) {
      creating.current = false;
      suppressForm = false;
      setLeaving(false);
      setError(err instanceof Error ? err.message : "試合を作れませんでした");
    }
  }

  if (leaving) {
    return (
      <main className="max-w-lg mx-auto w-full min-h-dvh">
        <AppHeader title="新しい試合" backHref="/" />
        <p className="p-6 text-[#9aa894]">打順を開いています…</p>
      </main>
    );
  }

  return (
    <GameSetupForm
      title="新しい試合"
      backHref="/"
      submitLabel="打順へ進む"
      teamName={teamDisplayName(team)}
      teamId={team?.id}
      teamOptions={teams}
      onSelectTeam={(id) => void setActiveTeamId(id)}
      teamsHrefLabel="1部・2部の追加や選手の修正"
      initial={{
        opponent: "",
        tournament: "",
        venue: "",
        date: today,
        mySide: "second",
        useDh: false,
        innings: 7,
        runChangeAt: 0,
      }}
      recentOpponents={recentOpponentNames(games)}
      recentTournaments={recentTournamentNames(games)}
      recentVenues={recentVenueNames(games)}
      error={error}
      onSubmit={(values) => void create(values)}
    />
  );
}
