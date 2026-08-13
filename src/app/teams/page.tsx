"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";

export default function TeamsPage() {
  const teams = useLiveQuery(() => db.teams.toArray()) ?? [];
  const team = teams[0];
  const players =
    useLiveQuery(() => (team ? db.players.where("teamId").equals(team.id).toArray() : []), [
      team?.id,
    ]) ?? [];
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [teamName, setTeamName] = useState("");

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="チーム・選手" backHref="/" />
      <div className="p-4 flex flex-col gap-4">
        {team ? (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const next = teamName.trim() || team.name;
              void db.teams.update(team.id, { name: next });
            }}
          >
            <input
              className="tap flex-1 px-3 bg-[#121a14]"
              defaultValue={team.name}
              onChange={(e) => setTeamName(e.target.value)}
              aria-label="チーム名"
            />
            <button type="submit" className="tap tap-accent px-4">
              保存
            </button>
          </form>
        ) : null}

        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl border border-[#2c3c30] px-3 py-2">
              <span className="text-[#9aa894] w-8">{p.number}</span>
              <span className="flex-1 font-bold">{p.name}</span>
              <button
                type="button"
                className="text-sm text-[#ff5a5a]"
                onClick={() => void db.players.delete(p.id)}
              >
                削除
              </button>
            </li>
          ))}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!team || !name.trim()) return;
            void db.players.add({
              id: newId(),
              teamId: team.id,
              name: name.trim(),
              number: number.trim(),
              createdAt: Date.now(),
            });
            setName("");
            setNumber("");
          }}
        >
          <input
            className="tap w-16 px-2 bg-[#121a14]"
            placeholder="背番号"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <input
            className="tap flex-1 px-3 bg-[#121a14]"
            placeholder="選手名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="tap tap-accent px-4">
            追加
          </button>
        </form>
      </div>
    </main>
  );
}
