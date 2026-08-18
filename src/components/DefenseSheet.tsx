"use client";

import { useMemo, useState } from "react";
import { commitPositionSwap, commitSub } from "@/lib/engine";
import { POSITION_LABELS } from "@/lib/types";
import type { Game, LineupSlot, Position, Side } from "@/lib/types";
import { Sheet } from "./Sheet";

const FIELD: Array<{ pos: Position; className: string }> = [
  { pos: "CF", className: "col-start-2 row-start-1" },
  { pos: "LF", className: "col-start-1 row-start-2" },
  { pos: "RF", className: "col-start-3 row-start-2" },
  { pos: "SS", className: "col-start-1 row-start-3" },
  { pos: "2B", className: "col-start-3 row-start-3" },
  { pos: "3B", className: "col-start-1 row-start-4" },
  { pos: "P", className: "col-start-2 row-start-4" },
  { pos: "1B", className: "col-start-3 row-start-4" },
  { pos: "C", className: "col-start-2 row-start-5" },
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
  onApply: (mut: (g: Game) => Game) => void;
  onClose: () => void;
}) {
  const [side, setSide] = useState<Side>(fieldingSide);
  const [mode, setMode] = useState<Mode>("position");
  const [pickedOrder, setPickedOrder] = useState<number | null>(null);
  const [typedName, setTypedName] = useState("");

  const slots = side === mySide ? lineup : otherLineup;
  const mine = side === mySide;
  const activeIds = useMemo(() => new Set(slots.map((s) => s.playerId)), [slots]);
  const bench = mine ? players.filter((p) => !activeIds.has(p.id)) : [];
  const picked = slots.find((s) => s.order === pickedOrder) ?? null;

  function slotAt(pos: Position) {
    return slots.find((s) => s.position === pos);
  }

  function clearPick() {
    setPickedOrder(null);
    setTypedName("");
  }

  function tapFielder(slot: LineupSlot) {
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
    const from = pickedOrder;
    onApply((g) => commitPositionSwap(g, side, from, slot.order));
    setPickedOrder(null);
  }

  function sendBench(player: { id: string; name: string; number?: string }) {
    if (!picked) return;
    onApply((g) =>
      commitSub(g, side, picked.order, player.id, player.name, picked.position, player.number),
    );
    clearPick();
  }

  const hint =
    mode === "position"
      ? picked
        ? `${POSITION_LABELS[picked.position]}の${picked.playerName} と入れ替える選手をタップ`
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
        <div className="grid grid-cols-3 grid-rows-5 gap-2">
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
                <span className="block text-[11px] opacity-80">{POSITION_LABELS[pos]}</span>
                <span className="block font-bold text-sm leading-tight break-words">
                  {slot?.playerName ?? "空き"}
                </span>
                {slot ? (
                  <span className="block text-[10px] text-[#9aa894]">
                    {slot.order}番{slot.number ? ` ${slot.number}` : ""}
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
          {mine && bench.length === 0 ? (
            <p className="text-sm text-[#9aa894]">控えがいません。名前を入力しても出せます。</p>
          ) : null}
          {bench.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tap tap-result w-full"
              disabled={!picked}
              onClick={() => sendBench(p)}
            >
              {p.number ? `${p.number} ` : ""}
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
        </p>
      )}

      <button type="button" className="tap tap-accent w-full" onClick={onClose}>
        完了
      </button>
    </Sheet>
  );
}
