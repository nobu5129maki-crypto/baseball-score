"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { GameSetupForm, type GameSetupValues } from "@/components/GameSetupForm";
import { db, saveGame } from "@/lib/db";
import { applyGameSetup } from "@/lib/game-setup";
import { recentOpponentNames, recentTournamentNames, recentVenueNames } from "@/lib/opponents";

export default function GameSetupPage({ params }: PageProps<"/games/[id]/setup">) {
  const { id } = use(params);
  return <GameSetupScreen gameId={id} />;
}

function GameSetupScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const team = useLiveQuery(async () => (await db.teams.toArray())[0]);
  const players =
    useLiveQuery(() => (team ? db.players.where("teamId").equals(team.id).toArray() : []), [
      team?.id,
    ]) ?? [];
  const games = useLiveQuery(() => db.games.toArray(), []) ?? [];
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (game === undefined) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }
  if (!game) {
    return (
      <main className="p-6">
        <p>試合が見つかりません。</p>
        <Link href="/" className="tap tap-accent px-4 inline-flex items-center mt-4">
          ホームへ
        </Link>
      </main>
    );
  }
  if (game.status !== "lineup") {
    return (
      <main className="max-w-lg mx-auto w-full min-h-dvh">
        <AppHeader title="試合の条件" backHref={game.status === "ended" ? `/games/${gameId}/summary` : `/games/${gameId}/score`} />
        <p className="p-6 text-[#9aa894] leading-relaxed">
          試合が始まっているため、先攻・後攻や日付はここでは変更できません。
        </p>
      </main>
    );
  }

  async function save(values: GameSetupValues) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const latest = await db.games.get(gameId);
      if (!latest || latest.status !== "lineup") {
        setError("この試合はすでに始まっているため、条件を変えられません。");
        setBusy(false);
        return;
      }
      await saveGame(
        applyGameSetup(
          latest,
          {
            opponentName: values.opponent,
            tournament: values.tournament,
            venue: values.venue,
            date: values.date,
            mySide: values.mySide,
            useDh: values.useDh,
            scheduledInnings: values.innings,
          },
          players,
        ),
      );
      router.replace(`/games/${gameId}/lineup`);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "保存できませんでした");
    }
  }

  return (
    <GameSetupForm
      title="試合の条件"
      backHref={`/games/${gameId}/lineup`}
      submitLabel="この内容で打順へ戻る"
      teamName={game.myTeamName}
      initial={{
        opponent: game.opponentName,
        tournament: game.tournament ?? "",
        venue: game.venue ?? "",
        date: game.date,
        mySide: game.mySide,
        useDh: Boolean(game.useDh),
        innings: game.scheduledInnings,
      }}
      recentOpponents={recentOpponentNames(games)}
      recentTournaments={recentTournamentNames(games)}
      recentVenues={recentVenueNames(games)}
      error={error}
      busy={busy}
      note="打順で入れた選手はそのまま残します。先攻と後攻を入れ替えると、それぞれの打順も入れ替わります。"
      onSubmit={(values) => void save(values)}
    />
  );
}
