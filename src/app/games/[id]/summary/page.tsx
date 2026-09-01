"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { GlossarySheet } from "@/components/GlossarySheet";
import { InningScoreTable } from "@/components/InningScoreTable";
import { PlayerIdentity } from "@/components/PlayerIdentity";
import { ScorebookView } from "@/components/ScorebookView";
import { collectGameBackup, gameBackupFileName, stringifyBackup } from "@/lib/backup";
import { deliverBackupFile } from "@/lib/backup-export";
import { db, deleteEndedGame } from "@/lib/db";
import { otherSide, reduceGame, totalRuns } from "@/lib/engine";
import { gameTimeReadout } from "@/lib/game-time";
import {
  formatInnings,
  pitcherDecisionMark,
  teamPitcherStats,
  type PitcherGameStats,
} from "@/lib/pitcher-stats";
import { buildScorebook } from "@/lib/scorebook";
import { gameSlashes, type PlayerSlash } from "@/lib/stats";

export default function SummaryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const game = useLiveQuery(() => (id ? db.games.get(id) : undefined), [id]);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [shareError, setShareError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [pitchHelp, setPitchHelp] = useState<string | null>(null);

  async function shareGame() {
    if (!id || shareBusy) return;
    setShareBusy(true);
    setShareMessage("");
    setShareError("");
    try {
      const backup = await collectGameBackup(id);
      if (!backup || !backup.games[0]) {
        setShareError("この試合を書き出せませんでした。");
        return;
      }
      const file = new File([stringifyBackup(backup)], gameBackupFileName(backup.games[0]), {
        type: "application/json",
      });
      const delivered = await deliverBackupFile(file, { title: "らくスコア 試合記録" });
      if (delivered === "cancelled") return;
      setShareMessage("この試合データを書き出しました。ファイルに残すと、履歴を消しても戻せます。");
    } catch {
      setShareError("書き出せませんでした。もう一度試してください。");
    } finally {
      setShareBusy(false);
    }
  }

  async function removeGame() {
    if (!id || !game || deleteBusy) return;
    if (game.status !== "ended") {
      setDeleteError("終了していない試合は削除できません。");
      return;
    }
    const ok = window.confirm(
      `この試合データを削除しますか？\n${game.date}　${game.myTeamName} vs ${game.opponentName}\n成績の集計からも消えます。戻すことはできません。`,
    );
    if (!ok) return;
    setDeleteBusy(true);
    setDeleteError("");
    try {
      const result = await deleteEndedGame(id);
      if (result === "deleted") {
        router.replace("/");
        return;
      }
      if (result === "not_ended") setDeleteError("終了していない試合は削除できません。");
      else setDeleteError("試合が見つかりませんでした。");
    } catch {
      setDeleteError("削除できませんでした。もう一度試してください。");
    } finally {
      setDeleteBusy(false);
    }
  }

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
  const timeReadout = gameTimeReadout(game);

  return (
    <main className="print-root max-w-lg mx-auto w-full min-h-dvh print:max-w-none">
      <div className="print:hidden">
        <AppHeader title="試合結果" backHref="/" />
      </div>
      <div className="p-4 flex flex-col gap-4 print:p-0">
        <header className="print-heading">
          <p className="text-sm text-[#9aa894] print:text-black">
            {game.date}
            {game.tournament ? `　${game.tournament}` : ""}
            {game.venue ? `　${game.venue}` : ""}
            　スコアブック
          </p>
          <h2 className="text-2xl font-bold text-center mt-1">
            {first} vs {second}
          </h2>
          <p className="text-center text-[#f5c518] font-bold print:text-black">{winner}</p>
          {timeReadout ? (
            <p className="text-sm text-center text-[#9aa894] print:text-black mt-2">{timeReadout}</p>
          ) : null}
        </header>

        <InningScoreTable game={game} state={state} firstName={first} secondName={second} />

        <PitcherStaff
          mineName={game.myTeamName}
          theirsName={game.opponentName}
          mine={teamPitcherStats(game, game.mySide)}
          theirs={teamPitcherStats(game, otherSide(game.mySide))}
          onHelpWin={() => setPitchHelp("win")}
        />

        <ScorebookView title={`先攻 ${first}`} side={book.first} innings={book.innings} />
        <ScorebookView title={`後攻 ${second}`} side={book.second} innings={book.innings} />

        <BattingLines
          mineName={game.myTeamName}
          theirsName={game.opponentName}
          mine={slashes.filter((p) => p.side === game.mySide)}
          theirs={slashes.filter((p) => p.side !== game.mySide)}
        />

        <div className="flex flex-col gap-2 print:hidden">
          <button type="button" className="tap tap-accent w-full" disabled={shareBusy} onClick={() => void shareGame()}>
            {shareBusy ? "書き出し中…" : "この試合データをバックアップする"}
          </button>
          {shareMessage ? <p className="text-sm text-[#3ddc84]">{shareMessage}</p> : null}
          {shareError ? <p className="text-sm text-[#ff5a5a]">{shareError}</p> : null}
          <div className="flex gap-2">
            <button type="button" className="tap flex-1" onClick={() => window.print()}>
              印刷 / PDF
            </button>
            <Link href={`/games/${id}/score`} className="tap flex-1 flex items-center justify-center">
              記録を見直す
            </Link>
          </div>
          {game.status === "ended" ? (
            <button
              type="button"
              className="tap tap-danger tap-sm w-full"
              disabled={deleteBusy}
              onClick={() => void removeGame()}
            >
              {deleteBusy ? "削除中…" : "この試合データを削除"}
            </button>
          ) : null}
          {deleteError ? <p className="text-sm text-[#ff5a5a]">{deleteError}</p> : null}
        </div>
        <p className="text-xs text-[#9aa894] print:hidden">
          印刷するとスコアブックが用紙に出ます。試合データはファイルに残すと、端末の履歴を消しても戻せます。削除すると成績からも消えます。
        </p>
      </div>
      {pitchHelp ? <GlossarySheet termId={pitchHelp} onClose={() => setPitchHelp(null)} /> : null}
    </main>
  );
}

function PitcherStaff({
  mineName,
  theirsName,
  mine,
  theirs,
  onHelpWin,
}: {
  mineName: string;
  theirsName: string;
  mine: PitcherGameStats[];
  theirs: PitcherGameStats[];
  onHelpWin: () => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h3 className="font-bold">投手成績</h3>
        <button
          type="button"
          className="print:hidden inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#2c3c30] bg-[#070a08] text-xs font-bold text-[#f5c518]"
          aria-label="勝利投手の条件の説明"
          onClick={onHelpWin}
        >
          ?
        </button>
      </div>
      <p className="text-xs text-[#9aa894] leading-relaxed -mt-2 print:hidden">
        勝利は、リードを奪ったまま勝ったときの責任投手に付きます。先発は規定回（7回制は4回、9回制は5回）が必要で、足りないときは最長の救援へ移ります（救援がいなければ先発のまま）。「？」で詳しく見られます。
      </p>
      <PitcherTeam title={`${mineName}（自チーム）`} pitchers={mine} />
      <PitcherTeam title={`${theirsName}（相手）`} pitchers={theirs} opponent />
    </section>
  );
}

function PitcherRecap({ pitchers }: { pitchers: PitcherGameStats[] }) {
  const winner = pitchers.find((p) => p.wins > 0);
  const loser = pitchers.find((p) => p.losses > 0);
  const closer = pitchers.find((p) => p.saves > 0);
  const bits = [
    winner ? `勝利 ${winner.name}` : null,
    loser ? `敗戦 ${loser.name}` : null,
    closer ? `セーブ ${closer.name}` : null,
  ].filter(Boolean);
  if (bits.length === 0) return null;
  return <p className="text-sm font-bold text-[#f5c518] print:text-black mb-3">{bits.join("　")}</p>;
}

function decisionClass(mark: string): string {
  if (mark === "勝") return "text-[#3ddc84] print:text-black";
  if (mark === "敗") return "text-[#ff5a5a] print:text-black";
  if (mark === "S") return "text-[#4aa8ff] print:text-black";
  return "text-[#9aa894]";
}

function PitcherTeam({
  title,
  pitchers,
  opponent,
}: {
  title: string;
  pitchers: PitcherGameStats[];
  opponent?: boolean;
}) {
  return (
    <div className={`result-block rounded-2xl border p-4 ${opponent ? "border-[#3a4a3e] bg-[#0b100c]" : "border-[#2c3c30]"}`}>
      <h4 className="font-bold mb-3">{title}</h4>
      {pitchers.length === 0 ? (
        <p className="text-sm text-[#9aa894]">投手の記録はありません。</p>
      ) : (
        <>
          <PitcherRecap pitchers={pitchers} />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#9aa894] text-right">
                <th className="text-left font-medium pb-1">投手</th>
                <th className="font-medium pb-1">勝敗</th>
                <th className="font-medium pb-1">S</th>
                <th className="font-medium pb-1">回数</th>
                <th className="font-medium pb-1">投球</th>
              </tr>
            </thead>
            <tbody>
              {pitchers.map((p) => {
                const mark = pitcherDecisionMark(p);
                return (
                  <tr key={p.playerId} className="border-b border-[#2c3c30] last:border-b-0">
                    <td className="py-2 font-bold text-left pr-2">{p.name}</td>
                    <td className={`py-2 text-right tabular-nums font-bold ${decisionClass(mark === "S" ? "" : mark)}`}>
                      {mark === "勝" || mark === "敗" ? mark : "—"}
                    </td>
                    <td className={`py-2 text-right tabular-nums font-bold ${decisionClass(mark === "S" ? "S" : "")}`}>
                      {p.saves > 0 ? "S" : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatInnings(p.outs)}</td>
                    <td className="py-2 text-right tabular-nums">{p.pitches}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function BattingLines({
  mineName,
  theirsName,
  mine,
  theirs,
}: {
  mineName: string;
  theirsName: string;
  mine: PlayerSlash[];
  theirs: PlayerSlash[];
}) {
  return (
    <section className="flex flex-col gap-6 mt-2">
      <h3 className="font-bold">打撃成績</h3>
      <BattingTeam title={`${mineName}（自チーム）`} rows={mine} />
      <BattingTeam title={`${theirsName}（相手）`} rows={theirs} opponent />
    </section>
  );
}

function BattingTeam({
  title,
  rows,
  opponent,
}: {
  title: string;
  rows: PlayerSlash[];
  opponent?: boolean;
}) {
  return (
    <div className={`result-block rounded-2xl border p-4 ${opponent ? "border-[#3a4a3e] bg-[#0b100c]" : "border-[#2c3c30]"}`}>
      <h4 className="font-bold mb-3">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-[#9aa894]">打席の記録はありません。</p>
      ) : (
        <ul className="text-sm flex flex-col gap-1">
          {rows.map((p) => (
            <li key={p.playerId} className="flex justify-between gap-3 border-b border-[#2c3c30] py-2 last:border-b-0">
              <span className="shrink-0 min-w-0">
                <PlayerIdentity order={p.order} name={p.name} size="sm" />
              </span>
              <BatterLine p={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BatterLine({ p }: { p: PlayerSlash }) {
  const extra = [p.bb ? `四球${p.bb}` : "", p.sb ? `盗塁${p.sb}` : ""].filter(Boolean);
  return (
    <span className="text-right tabular-nums">
      {p.ab}打数
      <span className={p.h > 0 ? "hit-mark" : ""}>{p.h}安打</span>
      {` 打点${p.rbi}`}
      {extra.length ? ` ${extra.join(" ")}` : ""}
    </span>
  );
}
