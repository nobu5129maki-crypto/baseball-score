"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { InningScoreTable } from "@/components/InningScoreTable";
import { ScorebookView } from "@/components/ScorebookView";
import { db } from "@/lib/db";
import { reduceGame, totalRuns } from "@/lib/engine";
import { buildScorebook } from "@/lib/scorebook";
import { batterLine, formatObp, gameSlashes } from "@/lib/stats";

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const game = useLiveQuery(() => (id ? db.games.get(id) : undefined), [id]);

  if (!id || !game) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }

  const state = reduceGame(game);
  const first = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const second = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const fr = totalRuns(state.scores.first);
  const sr = totalRuns(state.scores.second);
  const winner = fr === sr ? "引き分け" : fr > sr ? `${first}の勝ち` : `${second}の勝ち`;
  const book = buildScorebook(game);
  const slashes = gameSlashes(game);

  return (
    <main className="print-root max-w-lg mx-auto w-full min-h-dvh print:max-w-none">
      <div className="print:hidden">
        <AppHeader title="試合結果" backHref="/" />
      </div>
      <div className="p-4 flex flex-col gap-4 print:p-0">
        <header className="print-heading">
          <p className="text-sm text-[#9aa894] print:text-black">{game.date}　スコアブック</p>
          <h2 className="text-2xl font-bold text-center mt-1">
            {first} {fr} — {sr} {second}
          </h2>
          <p className="text-center text-[#f5c518] font-bold print:text-black">{winner}</p>
        </header>

        <InningScoreTable state={state} firstName={first} secondName={second} />

        <ScorebookView title={`先攻 ${first}`} side={book.first} innings={book.innings} />
        <ScorebookView title={`後攻 ${second}`} side={book.second} innings={book.innings} />

        <h3 className="font-bold mt-2">打撃成績</h3>
        <ul className="text-sm flex flex-col gap-1">
          {slashes.map((p) => (
            <li key={p.playerId} className="flex justify-between border-b border-[#2c3c30] py-1">
              <span>
                {p.order} {p.name}
              </span>
              <span>
                {batterLine(p)} 出塁{formatObp(p)} 盗{p.sb}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 print:hidden">
          <button type="button" className="tap tap-accent flex-1" onClick={() => window.print()}>
            印刷 / PDF
          </button>
          <Link href={`/games/${id}/score`} className="tap flex-1 flex items-center justify-center">
            記録を見直す
          </Link>
        </div>
        <p className="text-xs text-[#9aa894] print:hidden">
          印刷するとスコアブックが用紙に出ます。ダイアログで「PDFに保存」も選べます。
        </p>
      </div>
    </main>
  );
}
