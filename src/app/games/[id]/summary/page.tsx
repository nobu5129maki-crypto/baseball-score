"use client";

import { use } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { InningScoreTable } from "@/components/InningScoreTable";
import { db } from "@/lib/db";
import { reduceGame, totalRuns } from "@/lib/engine";

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const game = useLiveQuery(() => db.games.get(id), [id]);

  if (!game) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }

  const state = reduceGame(game);
  const first = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const second = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const fr = totalRuns(state.scores.first);
  const sr = totalRuns(state.scores.second);
  const winner =
    fr === sr ? "引き分け" : fr > sr ? `${first}の勝ち` : `${second}の勝ち`;

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="試合結果" backHref="/" />
      <div className="p-4 flex flex-col gap-4">
        <p className="text-sm text-[#9aa894]">{game.date}</p>
        <h2 className="text-2xl font-bold text-center">
          {first} {fr} — {sr} {second}
        </h2>
        <p className="text-center text-[#f5c518] font-bold">{winner}</p>
        <InningScoreTable state={state} firstName={first} secondName={second} />
        <div className="flex gap-2">
          {game.status !== "ended" ? (
            <Link href={`/games/${id}/score`} className="tap tap-accent flex-1 flex items-center justify-center">
              記録に戻る
            </Link>
          ) : (
            <Link href={`/games/${id}/score`} className="tap flex-1 flex items-center justify-center">
              記録を見直す
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
