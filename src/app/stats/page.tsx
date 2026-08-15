"use client";

import { useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { GlossarySheet } from "@/components/GlossarySheet";
import { db } from "@/lib/db";
import {
  formatAvg,
  formatObp,
  formatOps,
  myTeamSeason,
  myTeamSlashes,
  plateAppearances,
  sumSlashes,
  type PlayerSlash,
} from "@/lib/stats";

export default function StatsPage() {
  const team = useLiveQuery(async () => (await db.teams.toArray())[0]);
  const games =
    useLiveQuery(async () => {
      const rows = await db.games.toArray();
      return rows.filter((g) => g.status === "ended" || g.status === "in_progress");
    }) ?? [];
  const mine = team ? games.filter((g) => g.myTeamId === team.id) : games.filter((g) => g.myTeamId);
  const endedCount = mine.filter((g) => g.status === "ended").length;
  const rows = myTeamSlashes(mine);
  const season = myTeamSeason(mine);
  const total = sumSlashes(rows);
  const teamName = team?.name ?? "自チーム";
  const [help, setHelp] = useState<string | null>(null);

  return (
    <main className="print-root max-w-lg mx-auto w-full min-h-dvh print:max-w-none">
      <div className="print:hidden">
        <AppHeader title="成績" backHref="/" />
      </div>
      <div className="p-4 flex flex-col gap-4 print:p-0">
        <header className="print-heading">
          <p className="text-sm text-[#9aa894] print:text-black">
            {teamName}　{endedCount}試合の累積（進行中の試合も含む）
          </p>
          <h2 className="text-2xl font-bold mt-1">{teamName} の成績</h2>
        </header>

        <section>
          <h3 className="font-bold mb-2">チーム成績</h3>
          <div className="rounded-2xl border border-[#2c3c30] overflow-hidden">
            <dl className="grid grid-cols-3 text-center text-sm">
              <Stat label="勝敗" value={`${season.wins}勝 ${season.losses}敗 ${season.draws}分`} />
              <Stat label="得点" value={String(season.runsFor)} />
              <Stat label="失点" value={String(season.runsAgainst)} />
              <Stat label="安打" value={String(season.batting.h)} />
              <Stat label="盗塁" value={String(season.batting.sb)} />
              <Stat label="失策" value={String(season.errors)} />
              <Stat label="打率" value={formatAvg(season.batting.h, season.batting.ab)} />
              <Stat label="出塁率" value={formatObp(season.batting)} />
              <Stat label="OPS" value={formatOps(season.batting)} onHelp={() => setHelp("ops")} />
            </dl>
          </div>
        </section>

        <section>
          <h3 className="font-bold mb-2">個人成績</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-[#9aa894]">試合を記録すると、選手ごとの成績がここに集まります。</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#2c3c30]">
              <table className="w-full text-sm stats-table">
                <thead>
                  <tr className="text-[#9aa894] text-right bg-[#121a14]">
                    <th className="p-2 text-left font-medium sticky left-0 bg-[#121a14]">選手</th>
                    <th className="p-2 font-medium whitespace-nowrap">打席</th>
                    <th className="p-2 font-medium whitespace-nowrap">打数</th>
                    <th className="p-2 font-medium whitespace-nowrap">安打</th>
                    <th className="p-2 font-medium whitespace-nowrap">打率</th>
                    <th className="p-2 font-medium whitespace-nowrap">出塁率</th>
                    <th className="p-2 font-medium whitespace-nowrap">盗塁</th>
                    <th className="p-2 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center justify-end gap-1">
                        OPS
                        <HelpMark onClick={() => setHelp("ops")} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <SlashRow key={p.playerId} p={p} />
                  ))}
                  <SlashRow p={total} total />
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="flex gap-2 print:hidden">
          <button type="button" className="tap tap-accent flex-1" onClick={() => window.print()}>
            印刷 / PDF
          </button>
          <Link href="/" className="tap flex-1 flex items-center justify-center">
            ホーム
          </Link>
        </div>
        <p className="text-xs text-[#9aa894] print:hidden">
          印刷すると成績表が用紙に出ます。ダイアログで「PDFに保存」も選べます。
        </p>
      </div>
      {help ? <GlossarySheet termId={help} onClose={() => setHelp(null)} /> : null}
    </main>
  );
}

function HelpMark({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="print:hidden inline-flex items-center justify-center w-7 h-7 rounded-full border border-[#2c3c30] bg-[#070a08] text-xs font-bold text-[#f5c518]"
      aria-label="OPSの説明"
      onClick={onClick}
    >
      ?
    </button>
  );
}

function Stat({ label, value, onHelp }: { label: string; value: string; onHelp?: () => void }) {
  return (
    <div className="relative border-b border-r border-[#2c3c30] px-2 py-3 last:border-r-0">
      <dt className="text-xs text-[#9aa894] flex items-center justify-center gap-1">
        {label}
        {onHelp ? <HelpMark onClick={onHelp} /> : null}
      </dt>
      <dd className="font-bold mt-1 break-words">{value}</dd>
    </div>
  );
}

function SlashRow({ p, total }: { p: PlayerSlash; total?: boolean }) {
  return (
    <tr className={`border-t border-[#2c3c30] text-right ${total ? "font-bold bg-[#121a14]" : ""}`}>
      <td
        className={`p-2 text-left sticky left-0 whitespace-nowrap ${
          total ? "bg-[#121a14]" : "bg-[#070a08] font-bold"
        }`}
      >
        {total ? "チーム計" : p.name}
      </td>
      <td className="p-2">{plateAppearances(p)}</td>
      <td className="p-2">{p.ab}</td>
      <td className="p-2">{p.h}</td>
      <td className="p-2">{formatAvg(p.h, p.ab)}</td>
      <td className="p-2">{formatObp(p)}</td>
      <td className="p-2">{p.sb}</td>
      <td className="p-2">{formatOps(p)}</td>
    </tr>
  );
}
