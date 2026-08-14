"use client";

import { useRef, useState } from "react";
import { POSITION_LABELS, POSITIONS } from "@/lib/types";
import type { LineupSlot, Player, Position } from "@/lib/types";

type Drag =
  | { kind: "line"; order: number }
  | { kind: "bench"; playerId: string }
  | null;

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

export function LineupBoard({
  lineup,
  bench,
  onReplace,
  onMoveOrder,
  onPosition,
  onRename,
}: {
  lineup: LineupSlot[];
  bench: Player[];
  onReplace: (order: number, player: Player) => void;
  onMoveOrder: (fromOrder: number, toOrder: number) => void;
  onPosition: (order: number, position: Position) => void;
  onRename: (order: number, name: string) => void;
}) {
  const [drag, setDrag] = useState<Drag>(null);
  const [overOrder, setOverOrder] = useState<number | null>(null);
  const [overPos, setOverPos] = useState<Position | null>(null);
  const [picked, setPicked] = useState<Drag>(null);
  const live = useRef<Drag>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  function slotAt(pos: Position) {
    return lineup.find((s) => s.position === pos);
  }

  function applyDrop(order: number | null, pos: Position | null) {
    const current = live.current ?? picked;
    setDrag(null);
    setOverOrder(null);
    setOverPos(null);
    setPicked(null);
    live.current = null;
    if (!current) return;

    if (pos) {
      if (current.kind === "line") onPosition(current.order, pos);
      if (current.kind === "bench") {
        const target = slotAt(pos);
        const player = bench.find((p) => p.id === current.playerId);
        if (player && target) onReplace(target.order, player);
      }
      return;
    }

    if (order != null) {
      if (current.kind === "line" && current.order !== order) onMoveOrder(current.order, order);
      if (current.kind === "bench") {
        const player = bench.find((p) => p.id === current.playerId);
        if (player) onReplace(order, player);
      }
    }
  }

  function fromPoint(clientX: number, clientY: number) {
    const el = document.elementFromPoint(clientX, clientY);
    const orderEl = el?.closest("[data-drop-order]");
    const posEl = el?.closest("[data-drop-pos]");
    const order = orderEl ? Number(orderEl.getAttribute("data-drop-order")) : null;
    const pos = (posEl?.getAttribute("data-drop-pos") as Position | null) ?? null;
    return { order: Number.isFinite(order) ? order : null, pos };
  }

  function onPointerDown(e: React.PointerEvent, next: Drag) {
    e.currentTarget.setPointerCapture(e.pointerId);
    live.current = next;
    start.current = { x: e.clientX, y: e.clientY };
    setDrag(next);
    setPicked(next);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!live.current) return;
    const hit = fromPoint(e.clientX, e.clientY);
    setOverOrder(hit.order);
    setOverPos(hit.pos);
  }

  function onPointerUp(e: React.PointerEvent) {
    const origin = start.current;
    const moved =
      origin != null && (Math.abs(e.clientX - origin.x) > 12 || Math.abs(e.clientY - origin.y) > 12);
    start.current = null;
    if (moved) {
      const hit = fromPoint(e.clientX, e.clientY);
      applyDrop(hit.order, hit.pos);
    } else {
      setDrag(null);
      setOverOrder(null);
      setOverPos(null);
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[#9aa894]">
        選手を指でドラッグして打順や守備位置へ。または一度タップしてから置き場をタップ。
      </p>

      <div className="rounded-2xl border border-[#2c3c30] bg-[#0d140f] p-3">
        <p className="text-xs text-[#9aa894] mb-2">守備位置（ここに落とすと交代 / 位置替え）</p>
        <div className="grid grid-cols-3 grid-rows-5 gap-2">
          {FIELD.map(({ pos, className }) => {
            const slot = slotAt(pos);
            const hot = overPos === pos;
            return (
              <button
                key={pos}
                type="button"
                data-drop-pos={pos}
                className={`tap min-h-14 px-1 text-xs ${className} ${hot ? "tap-accent" : ""}`}
                onClick={() => {
                  if (picked) applyDrop(slot?.order ?? null, pos);
                }}
              >
                <span className="block text-[10px] opacity-70">{POSITION_LABELS[pos]}</span>
                <span className="font-bold">{slot?.playerName ?? "空き"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ol className="flex flex-col gap-2">
        {lineup.map((slot) => (
            <li
              key={slot.order}
              data-drop-order={slot.order}
              className={`rounded-xl border p-3 bg-[#121a14] ${overOrder === slot.order ? "border-[#f5c518]" : "border-[#2c3c30]"}`}
              onClick={() => {
                if (picked) applyDrop(slot.order, null);
              }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`tap min-h-12 w-12 px-0 text-lg touch-none ${picked?.kind === "line" && picked.order === slot.order ? "tap-accent" : ""}`}
                  onPointerDown={(e) => onPointerDown(e, { kind: "line", order: slot.order })}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                >
                  {slot.order}
                </button>
                <input
                  className="tap flex-1 px-2 bg-[#070a08] min-h-12"
                  lang="ja"
                  value={slot.playerName}
                  onChange={(e) => onRename(slot.order, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="grid grid-cols-5 gap-1 mt-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    className={`tap min-h-10 px-0 text-[11px] ${slot.position === pos ? "tap-accent" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPosition(slot.order, pos);
                    }}
                  >
                    {POSITION_LABELS[pos].slice(0, 3)}
                  </button>
                ))}
              </div>
            </li>
        ))}
      </ol>
      <h3 className="font-bold mt-2">ベンチ</h3>
      {bench.length === 0 ? (
        <p className="text-sm text-[#9aa894]">控えはいません。相手側は下の名簿コードも使えます。</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {bench.map((p) => (
            <button
              key={p.id}
              type="button"
              data-bench={p.id}
              className={`tap px-3 touch-none ${
                (drag?.kind === "bench" && drag.playerId === p.id) ||
                (picked?.kind === "bench" && picked.playerId === p.id)
                  ? "tap-accent"
                  : ""
              }`}
              onPointerDown={(e) => onPointerDown(e, { kind: "bench", playerId: p.id })}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onClick={() => setPicked({ kind: "bench", playerId: p.id })}
            >
              {p.number ? `${p.number} ` : ""}
              {p.name}
            </button>
          ))}
        </div>
      )}
      {picked ? (
        <p className="text-sm text-[#f5c518]">
          {picked.kind === "bench" ? "控えを選びました。打順または守備位置をタップ" : "打順を選びました。入れ替え先をタップ"}
        </p>
      ) : null}
    </div>
  );
}
