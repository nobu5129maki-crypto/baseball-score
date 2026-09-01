"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db, saveGame } from "@/lib/db";
import { newId } from "@/lib/ids";
import { recentOpponentNames, recentTournamentNames, recentVenueNames } from "@/lib/opponents";
import { lineupFromPlayers, opponentLineup, sidesFor } from "@/lib/seed";
import type { Side } from "@/lib/types";

/** 作成〜遷移のあいだ、再マウントしてもフォームを出さない */
let suppressForm = false;

export default function NewGamePage() {
  const router = useRouter();
  const team = useLiveQuery(async () => (await db.teams.toArray())[0]);
  const players =
    useLiveQuery(() => (team ? db.players.where("teamId").equals(team.id).toArray() : []), [
      team?.id,
    ]) ?? [];
  const games = useLiveQuery(() => db.games.toArray(), []) ?? [];
  const recentOpponents = recentOpponentNames(games);
  const recentTournaments = recentTournamentNames(games);
  const recentVenues = recentVenueNames(games);

  const today = new Date().toISOString().slice(0, 10);
  const [opponent, setOpponent] = useState("");
  const [tournament, setTournament] = useState("");
  const [venue, setVenue] = useState("");
  const [date, setDate] = useState(today);
  const [mySide, setMySide] = useState<Side>("second");
  const [innings, setInnings] = useState(7);
  const [leaving, setLeaving] = useState(() => suppressForm);
  const [error, setError] = useState("");
  const seededOpponent = useRef(false);
  const seededTournament = useRef(false);
  const seededVenue = useRef(false);
  const creating = useRef(false);

  useEffect(() => {
    return () => {
      suppressForm = false;
    };
  }, []);

  useEffect(() => {
    if (seededOpponent.current || !recentOpponents[0]) return;
    seededOpponent.current = true;
    setOpponent(recentOpponents[0]);
  }, [recentOpponents]);

  useEffect(() => {
    if (seededTournament.current || !recentTournaments[0]) return;
    seededTournament.current = true;
    setTournament(recentTournaments[0]);
  }, [recentTournaments]);

  useEffect(() => {
    if (seededVenue.current || !recentVenues[0]) return;
    seededVenue.current = true;
    setVenue(recentVenues[0]);
  }, [recentVenues]);

  async function create() {
    if (!team || creating.current || suppressForm) return;
    creating.current = true;
    suppressForm = true;
    setLeaving(true);
    setError("");
    try {
      const mine = lineupFromPlayers(players);
      const opp = opponentLineup();
      const sides = sidesFor(mySide, mine, opp);
      const id = newId();
      const meet = tournament.trim();
      const place = venue.trim();
      await saveGame({
        id,
        myTeamId: team.id,
        myTeamName: team.name,
        opponentName: opponent.trim() || "相手",
        ...(meet ? { tournament: meet } : {}),
        ...(place ? { venue: place } : {}),
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
      router.replace(`/games/${id}/lineup`);
    } catch (err) {
      creating.current = false;
      suppressForm = false;
      setLeaving(false);
      setError(err instanceof Error ? err.message : "試合を作れませんでした");
    }
  }

  if (leaving) {
    return (
      <main className="max-w-lg mx-auto w-full min-h-dvh">
        <AppHeader title="新しい試合" backHref="/" />
        <p className="p-6 text-[#9aa894]">打順を開いています…</p>
      </main>
    );
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
            placeholder="相手のチーム名"
            onChange={(e) => setOpponent(e.target.value)}
            list="recent-opponents"
          />
          <datalist id="recent-opponents">
            {recentOpponents.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        {recentOpponents.length > 0 ? (
          <div className="flex flex-wrap gap-2 -mt-2">
            {recentOpponents.map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                  opponent === name
                    ? "border-[#f5c518] bg-[#f5c518] text-[#14180c]"
                    : "border-[#2c3c30] bg-[#121a14] text-[#d5dccf]"
                }`}
                onClick={() => setOpponent(name)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[#9aa894]">大会名</span>
          <input
            className="tap px-3 bg-[#121a14]"
            value={tournament}
            placeholder="例: 春季大会（任意）"
            onChange={(e) => setTournament(e.target.value)}
            list="recent-tournaments"
          />
          <datalist id="recent-tournaments">
            {recentTournaments.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        {recentTournaments.length > 0 ? (
          <div className="flex flex-wrap gap-2 -mt-2">
            {recentTournaments.map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                  tournament === name
                    ? "border-[#f5c518] bg-[#f5c518] text-[#14180c]"
                    : "border-[#2c3c30] bg-[#121a14] text-[#d5dccf]"
                }`}
                onClick={() => setTournament(name)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-[#9aa894]">場所</span>
          <input
            className="tap px-3 bg-[#121a14]"
            value={venue}
            placeholder="例: ○○球場"
            onChange={(e) => setVenue(e.target.value)}
            list="recent-venues"
          />
          <datalist id="recent-venues">
            {recentVenues.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        {recentVenues.length > 0 ? (
          <div className="flex flex-wrap gap-2 -mt-2">
            {recentVenues.map((name) => (
              <button
                key={name}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                  venue === name
                    ? "border-[#f5c518] bg-[#f5c518] text-[#14180c]"
                    : "border-[#2c3c30] bg-[#121a14] text-[#d5dccf]"
                }`}
                onClick={() => setVenue(name)}
              >
                {name}
              </button>
            ))}
          </div>
        ) : null}
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
        <button type="submit" className="tap tap-accent mt-2" disabled={!team}>
          打順へ進む
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
