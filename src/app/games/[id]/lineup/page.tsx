"use client";

import { use, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { LineupBoard } from "@/components/LineupBoard";
import { commitSub, reduceGame } from "@/lib/engine";
import { db, saveGame } from "@/lib/db";
import { decodeRoster } from "@/lib/roster-share";
import { newId } from "@/lib/ids";
import type { LineupSlot, Player, Position, Side } from "@/lib/types";

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
  const savedRosters = useLiveQuery(() => db.rosters.orderBy("createdAt").reverse().toArray()) ?? [];
  const [tab, setTab] = useState<Side>("first");
  const [importText, setImportText] = useState("");
  const state = useMemo(() => (game ? reduceGame(game) : null), [game]);

  const names = useMemo(() => {
    if (!game) return { first: "", second: "" };
    return {
      first: game.mySide === "first" ? game.myTeamName : game.opponentName,
      second: game.mySide === "second" ? game.myTeamName : game.opponentName,
    };
  }, [game]);

  const lineup =
    tab === "first"
      ? (state?.firstLineup ?? game?.firstLineup)
      : (state?.secondLineup ?? game?.secondLineup);

  if (!game || !lineup) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }

  const slots: LineupSlot[] = lineup;
  const isMine = tab === game.mySide;
  const activeIds = new Set(slots.map((s) => s.playerId));
  const bench = isMine ? players.filter((p) => !activeIds.has(p.id)) : [];
  const ids = slots.map((s) => s.playerId);
  const dup = ids.some((pid, i) => ids.indexOf(pid) !== i);

  async function patchLineup(next: LineupSlot[]) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const key = tab === "first" ? "firstLineup" : "secondLineup";
    await saveGame({ ...latest, [key]: next });
  }

  async function applySlot(order: number, patch: Partial<LineupSlot>) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const slot = slots.find((s) => s.order === order);
    if (!slot) return;
    const nextSlot = { ...slot, ...patch };
    if (latest.status === "in_progress") {
      await saveGame(
        commitSub(latest, tab, order, nextSlot.playerId, nextSlot.playerName, nextSlot.position),
      );
      return;
    }
    await patchLineup(slots.map((s) => (s.order === order ? nextSlot : s)));
  }

  async function assignPosition(order: number, position: Position) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const current = slots.map((s) => ({ ...s }));
    const a = current.find((s) => s.order === order);
    const b = current.find((s) => s.position === position);
    if (!a) return;
    if (b && b.order !== a.order) {
      const tmp = a.position;
      a.position = b.position;
      b.position = tmp;
    } else {
      a.position = position;
    }
    if (latest.status === "in_progress") {
      let next = latest;
      next = commitSub(next, tab, a.order, a.playerId, a.playerName, a.position);
      if (b && b.order !== a.order) {
        next = commitSub(next, tab, b.order, b.playerId, b.playerName, b.position);
      }
      await saveGame(next);
      return;
    }
    await patchLineup(current);
  }

  async function moveOrder(from: number, to: number) {
    const copy = slots.map((s) => ({ ...s }));
    const a = copy.find((s) => s.order === from);
    const b = copy.find((s) => s.order === to);
    if (!a || !b) return;
    const swap = {
      playerName: a.playerName,
      playerId: a.playerId,
      number: a.number,
      position: a.position,
    };
    a.playerName = b.playerName;
    a.playerId = b.playerId;
    a.number = b.number;
    a.position = b.position;
    b.playerName = swap.playerName;
    b.playerId = swap.playerId;
    b.number = swap.number;
    b.position = swap.position;
    const latest = await db.games.get(gameId);
    if (!latest) return;
    if (latest.status === "in_progress") {
      let next = commitSub(latest, tab, a.order, a.playerId, a.playerName, a.position);
      next = commitSub(next, tab, b.order, b.playerId, b.playerName, b.position);
      await saveGame(next);
      return;
    }
    await patchLineup(copy);
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh pb-8">
      <AppHeader title="打順・守備" backHref={game.status === "in_progress" ? `/games/${gameId}/score` : "/"} />
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

        <LineupBoard
          lineup={slots}
          bench={bench as Player[]}
          onRename={(order, name) => void applySlot(order, { playerName: name })}
          onPosition={(order, position) => void assignPosition(order, position)}
          onReplace={(order, player) =>
            void applySlot(order, {
              playerId: player.id,
              playerName: player.name,
              number: player.number,
            })
          }
          onMoveOrder={(from, to) => void moveOrder(from, to)}
        />

        {!isMine ? (
          <div className="flex flex-col gap-2 mt-2">
            {savedRosters.length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-[#9aa894]">保存した相手名簿</p>
                {savedRosters.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="tap"
                    onClick={() => {
                      const next = slots.map((slot, i) => {
                        const p = r.players[i];
                        if (!p) return slot;
                        return {
                          ...slot,
                          playerId: `imp-${newId().slice(0, 8)}-${i + 1}`,
                          playerName: p.name,
                          number: p.number,
                        };
                      });
                      void saveGame({
                        ...game,
                        opponentName: r.name,
                        [tab === "first" ? "firstLineup" : "secondLineup"]: next,
                      });
                    }}
                  >
                    {r.name} を使う
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-[#9aa894]">相手メンバーをコードで読み込む</p>
            <textarea
              className="tap min-h-24 px-3 py-2 bg-[#121a14] text-sm"
              placeholder="相手から受け取ったコード"
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            <button
              type="button"
              className="tap"
              onClick={() => {
                const pack = decodeRoster(importText);
                if (!pack) return;
                const next = slots.map((slot, i) => {
                  const p = pack.players[i];
                  if (!p) return slot;
                  return {
                    ...slot,
                    playerId: `imp-${newId().slice(0, 8)}-${i + 1}`,
                    playerName: p.name,
                    number: p.number,
                  };
                });
                void saveGame({
                  ...game,
                  opponentName: pack.name,
                  [tab === "first" ? "firstLineup" : "secondLineup"]: next,
                });
                setImportText("");
              }}
            >
              読み込む
            </button>
          </div>
        ) : null}

        {game.status === "lineup" ? (
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
        ) : (
          <button
            type="button"
            className="tap tap-accent"
            onClick={() => router.push(`/games/${gameId}/score`)}
          >
            記録に戻る
          </button>
        )}
      </div>
    </main>
  );
}
