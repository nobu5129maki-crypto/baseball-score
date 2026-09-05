"use client";

import { useMemo, useState } from "react";
import { commitPositionSwap, commitSub } from "@/lib/engine";
import { rememberOpponentBench } from "@/lib/opponent-bench";
import { jerseyLabel } from "@/lib/labels";
import { PITCHER_ORDER, POSITION_LABELS, POSITION_NUMBERS, POSITION_SHORT } from "@/lib/types";
import type { Game, LineupSlot, PitcherOnly, Position, Side } from "@/lib/types";
import { Sheet } from "./Sheet";

const FIELD: Array<{ pos: Position; className: string }> = [
  { pos: "CF", className: "col-start-3 col-span-2 row-start-1" },
  { pos: "LF", className: "col-start-1 col-span-2 row-start-2" },
  { pos: "RF", className: "col-start-5 col-span-2 row-start-2" },
  { pos: "SS", className: "col-start-2 col-span-2 row-start-3" },
  { pos: "2B", className: "col-start-4 col-span-2 row-start-3" },
  { pos: "3B", className: "col-start-1 col-span-2 row-start-4" },
  { pos: "P", className: "col-start-3 col-span-2 row-start-4" },
  { pos: "1B", className: "col-start-5 col-span-2 row-start-4" },
  { pos: "C", className: "col-start-3 col-span-2 row-start-5" },
];

type Mode = "position" | "bench";

export function DefenseSheet({
  lineup,
  otherLineup,
  mySide,
  fieldingSide,
  myTeamName,
  opponentName,
  players,
  otherPlayers = [],
  useDh = false,
  myPitcher,
  otherPitcher,
  onApply,
  onClose,
}: {
  lineup: LineupSlot[];
  otherLineup: LineupSlot[];
  mySide: Side;
  fieldingSide: Side;
  myTeamName: string;
  opponentName: string;
  players: { id: string; name: string; number?: string }[];
  otherPlayers?: { id: string; name: string; number?: string }[];
  useDh?: boolean;
  myPitcher?: PitcherOnly;
  otherPitcher?: PitcherOnly;
  onApply: (mut: (g: Game) => Game) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState<Side>(fieldingSide);
  const [mode, setMode] = useState<Mode>("position");
  const [pickedOrder, setPickedOrder] = useState<number | null>(null);
  const [typedName, setTypedName] = useState("");

  const slots = side === mySide ? lineup : otherLineup;
  const pitcher = side === mySide ? myPitcher : otherPitcher;
  const mine = side === mySide;
  const activeIds = useMemo(() => {
    const ids = new Set(slots.map((s) => s.playerId));
    if (pitcher) ids.add(pitcher.playerId);
    return ids;
  }, [slots, pitcher]);
  const bench = (mine ? players : otherPlayers).filter((p) => !activeIds.has(p.id));
  const pitcherSlot: LineupSlot | null =
    useDh && pitcher
      ? { order: PITCHER_ORDER, position: "P", ...pitcher }
      : null;
  const picked =
    pickedOrder === PITCHER_ORDER
      ? pitcherSlot
      : (slots.find((s) => s.order === pickedOrder) ?? null);

  function slotAt(pos: Position) {
    if (useDh && pos === "P") return pitcherSlot ?? undefined;
    return slots.find((s) => s.position === pos);
  }

  function clearPick() {
    setPickedOrder(null);
    setTypedName("");
  }

  function tapFielder(slot: LineupSlot) {
    if (useDh && slot.order === PITCHER_ORDER) {
      if (mode === "bench") {
        setPickedOrder((cur) => (cur === PITCHER_ORDER ? null : PITCHER_ORDER));
      } else {
        setMode("bench");
        setPickedOrder(PITCHER_ORDER);
      }
      return;
    }
    if (mode === "bench") {
      setPickedOrder((cur) => (cur === slot.order ? null : slot.order));
      return;
    }
    if (pickedOrder == null) {
      setPickedOrder(slot.order);
      return;
    }
    if (pickedOrder === slot.order) {
      setPickedOrder(null);
      return;
    }
    if (useDh && pickedOrder === PITCHER_ORDER) {
      clearPick();
      return;
    }
    const from = pickedOrder;
    onApply((g) => commitPositionSwap(g, side, from, slot.order));
    setPickedOrder(null);
  }

  function sendBench(player: { id: string; name: string; number?: string }) {
    if (!picked) return;
    const outgoing = picked;
    onApply((g) => {
      let next = commitSub(
        g,
        side,
        outgoing.order,
        player.id,
        player.name,
        outgoing.position,
        player.number,
      );
      if (!mine) {
        next = rememberOpponentBench(next, {
          playerId: outgoing.playerId,
          playerName: outgoing.playerName,
          number: outgoing.number,
        });
      }
      return next;
    });
    clearPick();
  }

  const hint =
    mode === "position"
      ? picked
        ? useDh && picked.order === PITCHER_ORDER
          ? "投手の交代は「ベンチと交代」から行います"
          : `${POSITION_LABELS[picked.position]}の${picked.playerName} と入れ替える選手をタップ`
        : useDh
          ? "動かす選手をタップしてから、行き先の選手をタップします（投手は交代タブで）"
          : "動かす選手をタップしてから、行き先の選手をタップします"
      : picked
        ? `${POSITION_LABELS[picked.position]}の${picked.playerName} と交代する控えを選んでください`
        : "ベンチに下げる選手をタップしてください";

  return (
    <Sheet title="守備位置・交代" onClose={onClose} tall>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          className={`tap min-h-12 text-sm ${side === mySide ? "tap-accent" : ""}`}
          onClick={() => {
            setSide(mySide);
            clearPick();
          }}
        >
          {myTeamName}
        </button>
        <button
          type="button"
          className={`tap min-h-12 text-sm ${side !== mySide ? "tap-accent" : ""}`}
          onClick={() => {
            setSide(mySide === "first" ? "second" : "first");
            clearPick();
          }}
        >
          {opponentName}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <button
          type="button"
          className={`tap min-h-14 ${mode === "position" ? "tap-accent" : ""}`}
          onClick={() => {
            setMode("position");
            clearPick();
          }}
        >
          守備位置を入れ替え
        </button>
        <button
          type="button"
          className={`tap min-h-14 ${mode === "bench" ? "tap-accent" : ""}`}
          onClick={() => {
            setMode("bench");
            clearPick();
          }}
        >
          ベンチと交代
        </button>
      </div>

      <div className="rounded-xl border border-[#f5c518] bg-[#1a281c] px-3 py-2 mb-3 flex items-start gap-2">
        <p className="flex-1 text-sm text-[#f5c518] font-bold leading-relaxed">{hint}</p>
        {picked ? (
          <button type="button" className="text-sm underline shrink-0 mt-0.5" onClick={clearPick}>
            やり直す
          </button>
        ) : null}
      </div>

      <div className="rounded-2xl border border-[#2c3c30] bg-[#0d140f] p-3 mb-3">
        <div className="grid grid-cols-6 grid-rows-5 gap-2">
          {FIELD.map(({ pos, className }) => {
            const slot = slotAt(pos);
            const selected = slot != null && slot.order === pickedOrder;
            return (
              <button
                key={pos}
                type="button"
                disabled={!slot}
                className={`tap min-h-16 px-1 text-xs ${className} ${selected ? "tap-accent" : pos === "P" ? "border-[#f5c518]" : ""}`}
                onClick={() => slot && tapFielder(slot)}
              >
                <span className="block text-[11px] opacity-80">
                  <span className="font-bold tabular-nums text-[#f5c518]">{POSITION_NUMBERS[pos]}</span>
                  <span className="font-bold text-[#f5c518]">{POSITION_SHORT[pos]}</span>
                  {" "}
                  {POSITION_LABELS[pos]}
                </span>
                <span className="block text-sm font-bold leading-tight break-words">
                  {slot?.playerName ?? "空き"}
                </span>
                {slot ? (
                  <span className="block text-[10px] text-[#9aa894] tabular-nums">
                    {slot.order === PITCHER_ORDER ? "打順外" : `${slot.order}番`}
                    {slot.number ? `  ${jerseyLabel(slot.number)}` : ""}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "bench" ? (
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-sm font-bold">控え</p>
          {bench.length === 0 ? (
            <p className="text-sm text-[#9aa894]">
              {mine
                ? "控えがいません。名前を入力しても出せます。"
                : "打順画面で控えを追加するか、下に名前を入力してください。"}
            </p>
          ) : null}
          {bench.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tap tap-result w-full"
              disabled={!picked}
              onClick={() => sendBench(p)}
            >
              {p.number ? `${jerseyLabel(p.number)} ` : ""}
              {p.name} を出す
            </button>
          ))}
          <div className="flex gap-2 mt-1">
            <input
              className="tap flex-1 px-3 bg-[#070a08]"
              lang="ja"
              placeholder={picked ? `${picked.playerName} の代わりの名前` : "先に選手を選ぶ"}
              value={typedName}
              disabled={!picked}
              onChange={(e) => setTypedName(e.target.value)}
            />
            <button
              type="button"
              className="tap tap-accent px-4"
              disabled={!picked || !typedName.trim()}
              onClick={() => sendBench({ id: `sub-${Date.now()}`, name: typedName.trim() })}
            >
              出す
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
          打順はそのまま、守備位置だけ入れ替わります。続けて何人でも変えられます。
          {useDh ? " 指名打者は守備に就きません。" : ""}
        </p>
      )}

      <button type="button" className="tap tap-accent w-full" onClick={onClose}>
        完了
      </button>
    </Sheet>
  );
}
