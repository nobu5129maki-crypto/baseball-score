"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { InningScoreTable } from "@/components/InningScoreTable";
import { ScorebookView } from "@/components/ScorebookView";
import { backupFileName, backupSummary, collectBackup, stringifyBackup } from "@/lib/backup";
import { deliverBackupFile } from "@/lib/backup-export";
import { db } from "@/lib/db";
import { reduceGame, totalRuns } from "@/lib/engine";
import { buildScorebook } from "@/lib/scorebook";
import { formatObp, gameSlashes, type PlayerSlash } from "@/lib/stats";

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const game = useLiveQuery(() => (id ? db.games.get(id) : undefined), [id]);
  const [busy, setBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const [backupError, setBackupError] = useState("");

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

  async function exportThisGame() {
    if (busy) return;
    setBusy(true);
    setBackupMessage("");
    setBackupError("");
    try {
      const backup = await collectBackup();
      const text = stringifyBackup(backup);
      const name = backupFileName(backup.exportedAt);
      const file = new File([text], name, { type: "application/json" });
      const delivered = await deliverBackupFile(file);
      if (delivered === "cancelled") return;
      setBackupMessage(
        `${backupSummary(backup)}を書き出しました。ファイルに残すと、履歴を消しても戻せます。`,
      );
    } catch {
      setBackupError("書き出せませんでした。もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

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

        <InningScoreTable game={game} state={state} firstName={first} secondName={second} />

        <ScorebookView title={`先攻 ${first}`} side={book.first} innings={book.innings} />
        <ScorebookView title={`後攻 ${second}`} side={book.second} innings={book.innings} />

        <h3 className="font-bold mt-2">打撃成績</h3>
        <ul className="text-sm flex flex-col gap-1">
          {slashes.map((p) => (
            <li key={p.playerId} className="flex justify-between border-b border-[#2c3c30] py-1">
              <span>
                {p.order} {p.name}
              </span>
              <BatterLine p={p} />
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
        <div className="print:hidden flex flex-col gap-2">
          <button type="button" className="tap w-full" disabled={busy} onClick={() => void exportThisGame()}>
            この試合データをバックアップする
          </button>
          {backupMessage ? <p className="text-sm text-[#3ddc84]">{backupMessage}</p> : null}
          {backupError ? <p className="text-sm text-[#ff5a5a]">{backupError}</p> : null}
        </div>
        <p className="text-xs text-[#9aa894] print:hidden">
          印刷するとスコアブックが用紙に出ます。ダイアログで「PDFに保存」も選べます。試合データはファイルに残すと、端末の履歴を消しても戻せます。
        </p>
      </div>
    </main>
  );
}

function BatterLine({ p }: { p: PlayerSlash }) {
  const extra = [p.bb ? `四球${p.bb}` : "", p.sb ? `盗塁${p.sb}` : ""].filter(Boolean);
  return (
    <span>
      {p.ab}打数
      <span className={p.h > 0 ? "hit-mark" : ""}>{p.h}安打</span>
      {extra.length ? ` ${extra.join(" ")}` : ""} 出塁{formatObp(p)} 盗{p.sb}
    </span>
  );
}
