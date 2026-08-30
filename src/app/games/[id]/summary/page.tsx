"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { GameTimeFields } from "@/components/GameTimeFields";
import { InningScoreTable } from "@/components/InningScoreTable";
import { ScorebookView } from "@/components/ScorebookView";
import { collectGameBackup, gameBackupFileName, stringifyBackup } from "@/lib/backup";
import { deliverBackupFile } from "@/lib/backup-export";
import { db, deleteEndedGame, saveGame } from "@/lib/db";
import { otherSide, reduceGame, totalRuns } from "@/lib/engine";
import { applyGameTimes, gameTimeLabel } from "@/lib/game-time";
import { buildScorebook } from "@/lib/scorebook";
import { formatObp, gameSlashes, teamPitchers, type PitcherLine, type PlayerSlash } from "@/lib/stats";

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
  const times = gameTimeLabel(game);

  return (
    <main className="print-root max-w-lg mx-auto w-full min-h-dvh print:max-w-none">
      <div className="print:hidden">
        <AppHeader title="試合結果" backHref="/" />
      </div>
      <div className="p-4 flex flex-col gap-4 print:p-0">
        <header className="print-heading">
          <p className="text-sm text-[#9aa894] print:text-black">
            {game.date}　スコアブック
            {times ? `　${times}` : ""}
          </p>
          <h2 className="text-2xl font-bold text-center mt-1">
            {first} vs {second}
          </h2>
          <p className="text-center text-[#f5c518] font-bold print:text-black">{winner}</p>
        </header>

        <div className="print:hidden">
          <GameTimeFields
            startTime={game.startTime}
            endTime={game.endTime}
            onChange={(next) => {
              void saveGame(applyGameTimes(game, next));
            }}
          />
        </div>

        <InningScoreTable game={game} state={state} firstName={first} secondName={second} />

        <PitcherStaff
          mineName={game.myTeamName}
          theirsName={game.opponentName}
          mine={teamPitchers(game, game.mySide)}
          theirs={teamPitchers(game, otherSide(game.mySide))}
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
    </main>
  );
}

function PitcherStaff({
  mineName,
  theirsName,
  mine,
  theirs,
}: {
  mineName: string;
  theirsName: string;
  mine: PitcherLine[];
  theirs: PitcherLine[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-bold">投手成績</h3>
      <PitcherTeam title={`${mineName}（自チーム）`} pitchers={mine} />
      <PitcherTeam title={`${theirsName}（相手）`} pitchers={theirs} opponent />
    </section>
  );
}

function PitcherTeam({
  title,
  pitchers,
  opponent,
}: {
  title: string;
  pitchers: PitcherLine[];
  opponent?: boolean;
}) {
  return (
    <div className={`result-block rounded-2xl border p-4 ${opponent ? "border-[#3a4a3e] bg-[#0b100c]" : "border-[#2c3c30]"}`}>
      <h4 className="font-bold mb-3">{title}</h4>
      {pitchers.length === 0 ? (
        <p className="text-sm text-[#9aa894]">投手の記録はありません。</p>
      ) : (
        <ul className="text-sm flex flex-col gap-1">
          {pitchers.map((p) => (
            <li key={p.playerId} className="flex justify-between border-b border-[#2c3c30] py-2 last:border-b-0">
              <span className="font-bold">{p.name}</span>
              <span>{p.pitches}球</span>
            </li>
          ))}
        </ul>
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
              <span className="shrink-0">
                {p.order} {p.name}
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
    <span className="text-right">
      {p.ab}打数
      <span className={p.h > 0 ? "hit-mark" : ""}>{p.h}安打</span>
      {extra.length ? ` ${extra.join(" ")}` : ""} 出塁{formatObp(p)} 盗{p.sb}
    </span>
  );
}
