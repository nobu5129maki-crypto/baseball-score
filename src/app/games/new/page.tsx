"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db, saveGame } from "@/lib/db";
import { newId } from "@/lib/ids";
import { lineupFromPlayers, opponentLineup, sidesFor } from "@/lib/seed";
import type { Side } from "@/lib/types";

export default function NewGamePage() {
  const router = useRouter();
  const team = useLiveQuery(async () => (await db.teams.toArray())[0]);
  const players =
    useLiveQuery(() => (team ? db.players.where("teamId").equals(team.id).toArray() : []), [
      team?.id,
    ]) ?? [];

  const today = new Date().toISOString().slice(0, 10);
  const [opponent, setOpponent] = useState("相手チーム");
  const [date, setDate] = useState(today);
  const [mySide, setMySide] = useState<Side>("second");
  const [innings, setInnings] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    if (!team || busy) return;
    setBusy(true);
    setError("");
    try {
      const mine = lineupFromPlayers(players);
      const opp = opponentLineup();
      const sides = sidesFor(mySide, mine, opp);
      const id = newId();
      await saveGame({
        id,
        myTeamId: team.id,
        myTeamName: team.name,
        opponentName: opponent.trim() || "相手",
        mySide,
        scheduledInnings: innings,
        date,
        status: "lineup",
        firstLineup: sides.firstLineup,
        secondLineup: sides.secondLineup,
        events: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      router.push(`/games/${id}/lineup`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "試合を作れませんでした");
      setBusy(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="新しい試合" backHref="/" />
      <form
        className="p-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Field label="自チーム">{team?.name ?? "…"}</Field>
        <Link href="/teams" className="text-sm text-[#f5c518] -mt-2">
          チーム名・選手を修正する
        </Link>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[#9aa894]">相手チーム</span>
          <input
            className="tap px-3 bg-[#121a14]"
            value={opponent}
            onChange={(e) => setOpponent(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[#9aa894]">日付</span>
          <input
            type="date"
            className="tap px-3 bg-[#121a14]"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <fieldset>
          <legend className="text-sm text-[#9aa894] mb-2">自分たちは</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`tap ${mySide === "first" ? "tap-accent" : ""}`}
              onClick={() => setMySide("first")}
            >
              先攻
            </button>
            <button
              type="button"
              className={`tap ${mySide === "second" ? "tap-accent" : ""}`}
              onClick={() => setMySide("second")}
            >
              後攻
            </button>
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[#9aa894]">イニング</span>
          <select
            className="tap px-3 bg-[#121a14]"
            value={innings}
            onChange={(e) => setInnings(Number(e.target.value))}
          >
            {[5, 6, 7, 9, 12].map((n) => (
              <option key={n} value={n}>
                {n}回{n === 12 ? "（延長込み）" : ""}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="text-sm text-[#ff5a5a]">{error}</p> : null}
        <button type="submit" className="tap tap-accent mt-2" disabled={!team || busy}>
          {busy ? "作成中…" : "打順へ進む"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm text-[#9aa894]">{label}</p>
      <p className="tap px-3 flex items-center mt-1">{children}</p>
    </div>
  );
}
