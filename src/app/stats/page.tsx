"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db } from "@/lib/db";
import { formatAvg, formatObp, formatOps, myTeamSlashes, plateAppearances } from "@/lib/stats";

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

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="個人成績" backHref="/" />
      <div className="p-4 flex flex-col gap-3">
        <div>
          <p className="font-bold text-lg">{team?.name ?? "自チーム"}</p>
          <p className="text-sm text-[#9aa894] mt-1">
            {endedCount}試合の累積（進行中の試合も含む）
          </p>
          <p className="text-xs text-[#9aa894] mt-1">OPSは出塁率＋長打率です。</p>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-[#9aa894]">試合を記録すると、選手ごとの成績がここに集まります。</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#2c3c30]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#9aa894] text-right bg-[#121a14]">
                  <th className="p-2 text-left font-medium sticky left-0 bg-[#121a14]">選手</th>
                  <th className="p-2 font-medium whitespace-nowrap">打席</th>
                  <th className="p-2 font-medium whitespace-nowrap">打数</th>
                  <th className="p-2 font-medium whitespace-nowrap">安打</th>
                  <th className="p-2 font-medium whitespace-nowrap">打率</th>
                  <th className="p-2 font-medium whitespace-nowrap">出塁率</th>
                  <th className="p-2 font-medium whitespace-nowrap">盗塁</th>
                  <th className="p-2 font-medium whitespace-nowrap">OPS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.playerId} className="border-t border-[#2c3c30] text-right">
                    <td className="p-2 text-left font-bold sticky left-0 bg-[#070a08] whitespace-nowrap">
                      {p.name}
                    </td>
                    <td className="p-2">{plateAppearances(p)}</td>
                    <td className="p-2">{p.ab}</td>
                    <td className="p-2">{p.h}</td>
                    <td className="p-2 font-bold">{formatAvg(p.h, p.ab)}</td>
                    <td className="p-2">{formatObp(p)}</td>
                    <td className="p-2">{p.sb}</td>
                    <td className="p-2">{formatOps(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Link href="/" className="tap flex items-center justify-center mt-2">
          ホーム
        </Link>
      </div>
    </main>
  );
}
