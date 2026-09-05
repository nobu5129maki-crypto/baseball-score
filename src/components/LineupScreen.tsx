"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { LineupBoard } from "@/components/LineupBoard";
import { commitSub, getPitcherOnly, reduceGame } from "@/lib/engine";
import { rememberOpponentBench } from "@/lib/opponent-bench";
import { db, saveGame } from "@/lib/db";
import { pickPlayerProfile } from "@/lib/player-profile";
import { decodeRoster } from "@/lib/roster-share";
import { newId } from "@/lib/ids";
import { PITCHER_ORDER } from "@/lib/types";
import type { LineupSlot, PitcherOnly, Player, Position, Side } from "@/lib/types";

export function LineupScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const players =
    useLiveQuery(async () => {
      const g = await db.games.get(gameId);
      if (!g) return [];
      return db.players.where("teamId").equals(g.myTeamId).toArray();
    }, [gameId]) ?? [];
  const savedRosters =
    useLiveQuery(async () => {
      try {
        const rows = await db.rosters.toArray();
        return rows.sort((a, b) => b.createdAt - a.createdAt);
      } catch {
        return [];
      }
    }) ?? [];
  const [tab, setTab] = useState<Side>("first");
  const [importText, setImportText] = useState("");
  const [rosterSaved, setRosterSaved] = useState("");
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
  const pitcher =
    state && game?.useDh
      ? getPitcherOnly(state, tab)
      : tab === "first"
        ? game?.firstPitcher
        : game?.secondPitcher;

  if (game === undefined) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }
  if (!game || !lineup) {
    return (
      <main className="p-6">
        <p>試合が見つかりません。</p>
        <button type="button" className="tap tap-accent mt-4 px-4" onClick={() => router.push("/")}>
          ホームへ
        </button>
      </main>
    );
  }

  const slots: LineupSlot[] = lineup;
  const isMine = tab === game.mySide;
  const opponentBench = game.opponentBench ?? [];
  const activeIds = new Set(slots.map((s) => s.playerId));
  if (pitcher) activeIds.add(pitcher.playerId);
  const bench = isMine
    ? players.filter((p) => !activeIds.has(p.id))
    : opponentBench
        .filter((p) => !activeIds.has(p.playerId))
        .map(
          (p): Player => ({
            id: p.playerId,
            teamId: "opponent",
            name: p.playerName,
            number: p.number ?? "",
            createdAt: 0,
          }),
        );
  const ids = slots.map((s) => s.playerId);
  const dup = ids.some((pid, i) => ids.indexOf(pid) !== i);

  async function patchLineup(next: LineupSlot[]) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const key = tab === "first" ? "firstLineup" : "secondLineup";
    await saveGame({ ...latest, [key]: next });
  }

  async function patchPitcher(next: PitcherOnly) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    let g = latest;
    if (!isMine && pitcher && pitcher.playerId !== next.playerId) {
      g = rememberOpponentBench(g, pitcher);
    }
    if (g.status === "in_progress") {
      await saveGame(
        commitSub(g, tab, PITCHER_ORDER, next.playerId, next.playerName, "P", next.number),
      );
      return;
    }
    const key = tab === "first" ? "firstPitcher" : "secondPitcher";
    await saveGame({ ...g, [key]: next });
  }

  async function addOpponentBench(name: string, number: string) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const extra: PitcherOnly = {
      playerId: `opp-bench-${newId()}`,
      playerName: name,
      ...(number ? { number } : {}),
    };
    await saveGame({ ...latest, opponentBench: [...(latest.opponentBench ?? []), extra] });
  }

  async function removeOpponentBench(playerId: string) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    await saveGame({
      ...latest,
      opponentBench: (latest.opponentBench ?? []).filter((p) => p.playerId !== playerId),
    });
  }

  async function replaceOpponentSlot(order: number, player: Player) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const slot = slots.find((s) => s.order === order);
    if (!slot) return;
    const remaining = [...(latest.opponentBench ?? [])];
    if (!remaining.some((p) => p.playerId === slot.playerId)) {
      remaining.push({
        playerId: slot.playerId,
        playerName: slot.playerName,
        ...(slot.number ? { number: slot.number } : {}),
      });
    }
    const nextSlots = slots.map((s) =>
      s.order === order
        ? {
            ...s,
            playerId: player.id,
            playerName: player.name,
            number: player.number || undefined,
          }
        : s,
    );
    const lineupKey = tab === "first" ? "firstLineup" : "secondLineup";
    if (latest.status === "in_progress") {
      await saveGame({
        ...commitSub(latest, tab, order, player.id, player.name, slot.position, player.number || undefined),
        opponentBench: remaining,
      });
      return;
    }
    await saveGame({ ...latest, [lineupKey]: nextSlots, opponentBench: remaining });
  }

  async function saveOpponentRoster() {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const lineupKey = tab === "first" ? "firstLineup" : "secondLineup";
    const current = latest[lineupKey];
    const pitcherSlot = tab === "first" ? latest.firstPitcher : latest.secondPitcher;
    const playersForPack = [
      ...current.map((s) => ({ name: s.playerName, number: s.number ?? "" })),
      ...(pitcherSlot ? [{ name: pitcherSlot.playerName, number: pitcherSlot.number ?? "" }] : []),
      ...(latest.opponentBench ?? []).map((p) => ({ name: p.playerName, number: p.number ?? "" })),
    ].filter((p) => p.name.trim() && !/^相手\d+$/.test(p.name.trim()) && p.name !== "相手投手");
    if (playersForPack.length === 0) return;
    await db.rosters.add({
      id: newId(),
      name: latest.opponentName,
      players: playersForPack,
      createdAt: Date.now(),
    });
    setRosterSaved(`${latest.opponentName} の名簿を保存しました。次の試合でも使えます。`);
  }

  async function applySlot(order: number, patch: Partial<LineupSlot>) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    const slot = slots.find((s) => s.order === order);
    if (!slot) return;
    const nextSlot = { ...slot, ...patch };
    if (latest.status === "in_progress") {
      await saveGame(
        commitSub(
          latest,
          tab,
          order,
          nextSlot.playerId,
          nextSlot.playerName,
          nextSlot.position,
          nextSlot.number,
        ),
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
      next = commitSub(next, tab, a.order, a.playerId, a.playerName, a.position, a.number);
      if (b && b.order !== a.order) {
        next = commitSub(next, tab, b.order, b.playerId, b.playerName, b.position, b.number);
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
      let next = commitSub(latest, tab, a.order, a.playerId, a.playerName, a.position, a.number);
      next = commitSub(next, tab, b.order, b.playerId, b.playerName, b.position, b.number);
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
        <p className="text-sm text-[#9aa894] leading-relaxed">
          {isMine
            ? "打順は各選手の右にある ▲▼ で入れ替えます。"
            : "相手がアプリを使っていなくても、名前と背番号をここに直接書けます。"}
          {game.useDh ? " この試合はDH制です。" : ""}
        </p>
        {rosterSaved ? <p className="text-sm text-[#3ddc84]">{rosterSaved}</p> : null}

        <LineupBoard
          lineup={slots}
          bench={bench as Player[]}
          useDh={Boolean(game.useDh)}
          pitcher={pitcher}
          manualRoster={!isMine}
          onRename={(order, name) => void applySlot(order, { playerName: name })}
          onNumber={
            isMine ? undefined : (order, number) => void applySlot(order, { number: number || undefined })
          }
          onPosition={(order, position) => void assignPosition(order, position)}
          onReplace={(order, player) => {
            if (isMine) {
              void applySlot(order, {
                playerId: player.id,
                playerName: player.name,
                number: player.number,
                ...pickPlayerProfile(player),
              });
              return;
            }
            void replaceOpponentSlot(order, player);
          }}
          onMoveOrder={(from, to) => void moveOrder(from, to)}
          onPitcherChange={game.useDh ? (next) => void patchPitcher(next) : undefined}
          onAddBench={!isMine ? (p) => void addOpponentBench(p.name, p.number) : undefined}
          onRemoveBench={!isMine ? (id) => void removeOpponentBench(id) : undefined}
        />

        {!isMine ? (
          <div className="flex flex-col gap-2 mt-2">
            <button type="button" className="tap" onClick={() => void saveOpponentRoster()}>
              この相手名簿を保存する
            </button>
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
                          ...pickPlayerProfile(p),
                        };
                      });
                      const extras = r.players.slice(slots.length).map((p, i) => ({
                        playerId: `imp-${newId().slice(0, 8)}-b${i + 1}`,
                        playerName: p.name,
                        ...(p.number ? { number: p.number } : {}),
                      }));
                      void saveGame({
                        ...game,
                        opponentName: r.name,
                        [tab === "first" ? "firstLineup" : "secondLineup"]: next,
                        opponentBench: extras,
                      });
                    }}
                  >
                    {r.name} を使う
                  </button>
                ))}
              </div>
            ) : null}
            <p className="text-sm text-[#9aa894] mt-2">アプリを使っている相手は、コードでも読み込めます</p>
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
                    ...pickPlayerProfile(p),
                  };
                });
                const extras = pack.players.slice(slots.length).map((p, i) => ({
                  playerId: `imp-${newId().slice(0, 8)}-b${i + 1}`,
                  playerName: p.name,
                  ...(p.number ? { number: p.number } : {}),
                }));
                void saveGame({
                  ...game,
                  opponentName: pack.name,
                  [tab === "first" ? "firstLineup" : "secondLineup"]: next,
                  opponentBench: extras,
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
