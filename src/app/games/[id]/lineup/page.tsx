"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { db, saveGame } from "@/lib/db";
import { POSITION_LABELS, POSITIONS } from "@/lib/types";
import type { LineupSlot, Position, Side } from "@/lib/types";

export default function LineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <LineupEditor gameId={id} />;
}

function LineupEditor({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const players =
    useLiveQuery(async () => {
      const g = await db.games.get(gameId);
      if (!g) return [];
      return db.players.where("teamId").equals(g.myTeamId).toArray();
    }, [gameId]) ?? [];
  const [tab, setTab] = useState<Side>("first");

  const lineup = tab === "first" ? game?.firstLineup : game?.secondLineup;
  const names = useMemo(() => {
    if (!game) return { first: "", second: "" };
    return {
      first: game.mySide === "first" ? game.myTeamName : game.opponentName,
      second: game.mySide === "second" ? game.myTeamName : game.opponentName,
    };
  }, [game]);

  if (!game || !lineup) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }

  const isMine = tab === game.mySide;
  const ids = lineup.map((s) => s.playerId);
  const dup = ids.some((id, i) => ids.indexOf(id) !== i);

  async function updateSlot(order: number, patch: Partial<LineupSlot>) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const key = tab === "first" ? "firstLineup" : "secondLineup";
    const next = latest[key].map((s) => (s.order === order ? { ...s, ...patch } : s));
    await saveGame({ ...latest, [key]: next });
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh pb-8">
      <AppHeader title="打順・守備" backHref="/" />
      <div className="p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={`tap ${tab === "first" ? "tap-accent" : ""}`} onClick={() => setTab("first")}>
            先攻 {names.first}
          </button>
          <button type="button" className={`tap ${tab === "second" ? "tap-accent" : ""}`} onClick={() => setTab("second")}>
            後攻 {names.second}
          </button>
        </div>
        {dup ? <p className="text-sm text-[#ff5a5a]">同じ選手が重複しています</p> : null}
        <ol className="flex flex-col gap-2">
          {lineup.map((slot) => (
            <li key={slot.order} className="rounded-xl border border-[#2c3c30] p-3 bg-[#121a14]">
              <div className="flex items-center gap-2">
                <span className="font-bold w-8">{slot.order}</span>
                {isMine ? (
                  <select
                    className="tap flex-1 px-2 bg-[#070a08] min-h-12"
                    value={slot.playerId}
                    onChange={(e) => {
                      const p = players.find((x) => x.id === e.target.value);
                      if (!p) return;
                      void updateSlot(slot.order, { playerId: p.id, playerName: p.name });
                    }}
                  >
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.number ? `${p.number} ` : ""}
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="tap flex-1 px-2 bg-[#070a08] min-h-12"
                    value={slot.playerName}
                    onChange={(e) => void updateSlot(slot.order, { playerName: e.target.value })}
                  />
                )}
                <select
                  className="tap w-28 px-1 bg-[#070a08] min-h-12 text-sm"
                  value={slot.position}
                  onChange={(e) =>
                    void updateSlot(slot.order, { position: e.target.value as Position })
                  }
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {POSITION_LABELS[pos]}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="tap tap-accent"
          disabled={dup}
          onClick={() => {
            void saveGame({ ...game, status: "in_progress" }).then(() =>
              router.push(`/games/${gameId}/score`),
            );
          }}
        >
          試合を始める
        </button>
      </div>
    </main>
  );
}
