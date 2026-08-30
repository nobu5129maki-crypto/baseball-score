"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { InstallPrompt } from "@/components/InstallPrompt";
import { db, deleteEndedGame } from "@/lib/db";
import { inningLabel, reduceGame, totalRuns } from "@/lib/engine";
import { gameTimeLabel } from "@/lib/game-time";
import type { Game } from "@/lib/types";

export default function HomePage() {
  const games =
    useLiveQuery(() => db.games.orderBy("updatedAt").reverse().toArray()) ?? [];
  const team = useLiveQuery(async () => (await db.teams.toArray())[0]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const active = games.filter((g) => g.status === "in_progress");
  const setup = games.filter((g) => g.status === "lineup");
  const done = games.filter((g) => g.status === "ended");

  async function removeEnded(game: Game) {
    if (deletingId) return;
    const state = reduceGame(game);
    const first = game.mySide === "first" ? game.myTeamName : game.opponentName;
    const second = game.mySide === "second" ? game.myTeamName : game.opponentName;
    const ok = window.confirm(
      `この試合データを削除しますか？\n${game.date}　${first} ${totalRuns(state.scores.first)} — ${totalRuns(state.scores.second)} ${second}\n成績の集計からも消えます。戻すことはできません。`,
    );
    if (!ok) return;
    setDeletingId(game.id);
    setDeleteError("");
    try {
      const result = await deleteEndedGame(game.id);
      if (result === "not_ended") {
        setDeleteError("終了していない試合は削除できません。");
      } else if (result === "not_found") {
        setDeleteError("試合が見つかりませんでした。");
      }
    } catch {
      setDeleteError("削除できませんでした。もう一度試してください。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh flex flex-col">
      <header className="px-4 py-5">
        <p className="text-sm text-[#9aa894]">記号いらずのスコア記録</p>
        <h1 className="text-2xl font-bold mt-1">らくスコア</h1>
        {team ? <p className="text-sm text-[#f5c518] mt-1">{team.name}</p> : null}
      </header>

      <section className="px-4 flex flex-col gap-3 flex-1">
        <InstallPrompt />
        {active.map((g) => (
          <GameCard key={g.id} game={g} cta="試合を続ける" href={`/games/${g.id}/score`} highlight />
        ))}
        {setup.map((g) => (
          <GameCard key={g.id} game={g} cta="打順を決める" href={`/games/${g.id}/lineup`} />
        ))}

        <Link href="/games/new" className="tap tap-accent flex items-center justify-center">
          {games.length === 0 ? "最初の試合を作る" : "新しい試合"}
        </Link>

        {done.length > 0 ? (
          <div className="mt-4">
            <h2 className="text-sm text-[#9aa894] mb-2">終わった試合</h2>
            <div className="flex flex-col gap-2">
              {done.map((g) => (
                <EndedGameCard
                  key={g.id}
                  game={g}
                  busy={deletingId === g.id}
                  onDelete={() => void removeEnded(g)}
                />
              ))}
            </div>
            {deleteError ? <p className="text-sm text-[#ff5a5a] mt-2">{deleteError}</p> : null}
          </div>
        ) : null}
      </section>

      <nav className="sticky bottom-0 border-t border-[#2c3c30] bg-[#070a08] px-4 py-3 flex gap-2">
        <Link href="/teams" className="tap flex-1 flex items-center justify-center text-sm">
          チーム
        </Link>
        <Link href="/stats" className="tap flex-1 flex items-center justify-center text-sm">
          成績
        </Link>
        <Link href="/settings" className="tap flex-1 flex items-center justify-center text-sm">
          設定
        </Link>
      </nav>
    </main>
  );
}

function GameCard({
  game,
  cta,
  href,
  highlight,
}: {
  game: Game;
  cta: string;
  href: string;
  highlight?: boolean;
}) {
  const state = reduceGame(game);
  const first = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const second = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const times = gameTimeLabel(game);
  return (
    <Link
      href={href}
      className={`block rounded-2xl border p-4 ${highlight ? "border-[#f5c518] bg-[#1a281c]" : "border-[#2c3c30] bg-[#121a14]"}`}
    >
      <p className="text-xs text-[#9aa894]">
        {game.date}
        {times ? `　${times}` : ""}
      </p>
      <p className="font-bold text-lg mt-1">
        {first} {totalRuns(state.scores.first)} — {totalRuns(state.scores.second)} {second}
      </p>
      <p className="text-sm text-[#9aa894] mt-1">
        {game.status === "ended" ? "終了" : inningLabel(state.inning, state.half)} · {cta}
      </p>
    </Link>
  );
}

function EndedGameCard({
  game,
  busy,
  onDelete,
}: {
  game: Game;
  busy: boolean;
  onDelete: () => void;
}) {
  const state = reduceGame(game);
  const first = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const second = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const times = gameTimeLabel(game);
  return (
    <div className="rounded-2xl border border-[#2c3c30] bg-[#121a14] p-4 flex flex-col gap-3">
      <Link href={`/games/${game.id}/summary`} className="block">
        <p className="text-xs text-[#9aa894]">
          {game.date}
          {times ? `　${times}` : ""}
        </p>
        <p className="font-bold text-lg mt-1">
          {first} {totalRuns(state.scores.first)} — {totalRuns(state.scores.second)} {second}
        </p>
        <p className="text-sm text-[#9aa894] mt-1">終了 · 結果を見る</p>
      </Link>
      <button
        type="button"
        className="tap tap-danger w-full text-sm"
        disabled={busy}
        aria-label={`${game.date}の試合を削除`}
        onClick={onDelete}
      >
        {busy ? "削除中…" : "この試合を削除"}
      </button>
    </div>
  );
}
