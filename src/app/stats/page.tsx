"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db } from "@/lib/db";
import { formatAvg, formatObp, mergeSlashes } from "@/lib/stats";

export default function StatsPage() {
  const games = useLiveQuery(() => db.games.where("status").equals("ended").toArray()) ?? [];
  const myGames = games.filter((g) => g.myTeamId);
  const rows = mergeSlashes(myGames).filter(
    (p) =>
      p.ab + p.bb + p.hbp + p.sf + p.sb > 0 &&
      !p.playerId.startsWith("opp-") &&
      !p.playerId.startsWith("imp-"),
  );

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="個人成績" backHref="/" />
      <div className="p-4">
        {rows.length === 0 ? (
          <p className="text-sm text-[#9aa894]">終了した試合の成績がここに集まります。</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#9aa894] text-left">
                <th className="p-2">選手</th>
                <th className="p-2">打率</th>
                <th className="p-2">出塁率</th>
                <th className="p-2">盗塁</th>
                <th className="p-2">安打</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.playerId} className="border-t border-[#2c3c30]">
                  <td className="p-2 font-bold">{p.name}</td>
                  <td className="p-2">{formatAvg(p.h, p.ab)}</td>
                  <td className="p-2">{formatObp(p)}</td>
                  <td className="p-2">{p.sb}</td>
                  <td className="p-2">
                    {p.h}-{p.ab}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Link href="/" className="tap flex items-center justify-center mt-4">
          ホーム
        </Link>
      </div>
    </main>
  );
}
