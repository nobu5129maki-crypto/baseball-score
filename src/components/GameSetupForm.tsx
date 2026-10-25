"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import type { Side } from "@/lib/types";

export type GameSetupValues = {
  opponent: string;
  tournament: string;
  venue: string;
  date: string;
  mySide: Side;
  useDh: boolean;
  innings: number;
};

export function GameSetupForm({
  title,
  backHref,
  submitLabel,
  teamName,
  initial,
  recentOpponents,
  recentTournaments,
  recentVenues,
  error,
  busy,
  note,
  onSubmit,
}: {
  title: string;
  backHref: string;
  submitLabel: string;
  teamName: string;
  initial: GameSetupValues;
  recentOpponents: string[];
  recentTournaments: string[];
  recentVenues: string[];
  error?: string;
  busy?: boolean;
  note?: string;
  onSubmit: (values: GameSetupValues) => void;
}) {
  const [opponent, setOpponent] = useState(initial.opponent);
  const [tournament, setTournament] = useState(initial.tournament);
  const [venue, setVenue] = useState(initial.venue);
  const [date, setDate] = useState(initial.date);
  const [mySide, setMySide] = useState<Side>(initial.mySide);
  const [useDh, setUseDh] = useState(initial.useDh);
  const [innings, setInnings] = useState(initial.innings);
  const seededOpponent = useRef(Boolean(initial.opponent));
  const seededTournament = useRef(Boolean(initial.tournament));
  const seededVenue = useRef(Boolean(initial.venue));

  useEffect(() => {
    if (seededOpponent.current || opponent || !recentOpponents[0]) return;
    seededOpponent.current = true;
    setOpponent(recentOpponents[0]);
  }, [opponent, recentOpponents]);

  useEffect(() => {
    if (seededTournament.current || tournament || !recentTournaments[0]) return;
    seededTournament.current = true;
    setTournament(recentTournaments[0]);
  }, [recentTournaments, tournament]);

  useEffect(() => {
    if (seededVenue.current || venue || !recentVenues[0]) return;
    seededVenue.current = true;
    setVenue(recentVenues[0]);
  }, [recentVenues, venue]);

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title={title} backHref={backHref} />
      <form
        className="p-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          onSubmit({ opponent, tournament, venue, date, mySide, useDh, innings });
        }}
      >
        {note ? <p className="text-sm text-[#9aa894] leading-relaxed">{note}</p> : null}
        <Field label="自チーム">{teamName}</Field>
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
          <ChipRow values={recentOpponents} selected={opponent} onPick={setOpponent} />
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
          <ChipRow values={recentTournaments} selected={tournament} onPick={setTournament} />
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
          <ChipRow values={recentVenues} selected={venue} onPick={setVenue} />
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
        <fieldset>
          <legend className="text-sm text-[#9aa894] mb-2">指名打者（DH）</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className={`tap ${!useDh ? "tap-accent" : ""}`}
              onClick={() => setUseDh(false)}
            >
              使わない
            </button>
            <button
              type="button"
              className={`tap ${useDh ? "tap-accent" : ""}`}
              onClick={() => setUseDh(true)}
            >
              DH制
            </button>
          </div>
          <p className="text-xs text-[#9aa894] mt-2 leading-relaxed">
            DH制では投手が打席に立たず、指名打者が代わりに打ちます。
          </p>
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
        <button type="submit" className="tap tap-accent mt-2" disabled={busy || teamName === "…"}>
          {busy ? "保存しています…" : submitLabel}
        </button>
      </form>
    </main>
  );
}

function ChipRow({
  values,
  selected,
  onPick,
}: {
  values: string[];
  selected: string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 -mt-2">
      {values.map((name) => (
        <button
          key={name}
          type="button"
          className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
            selected === name
              ? "border-[#f5c518] bg-[#f5c518] text-[#14180c]"
              : "border-[#2c3c30] bg-[#121a14] text-[#d5dccf]"
          }`}
          onClick={() => onPick(name)}
        >
          {name}
        </button>
      ))}
    </div>
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
