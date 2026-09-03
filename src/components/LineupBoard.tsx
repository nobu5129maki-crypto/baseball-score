"use client";

import { useState } from "react";
import { playerProfileLabel } from "@/lib/player-profile";
import {
  FIELD_POSITIONS,
  PITCHER_ORDER,
  POSITION_LABELS,
  POSITION_NUMBERS,
  POSITION_SHORT,
} from "@/lib/types";
import type { LineupSlot, PitcherOnly, Player, Position } from "@/lib/types";
import { ImeTextInput } from "./ImeTextInput";
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

function positionChoices(useDh: boolean): Position[] {
  if (!useDh) return FIELD_POSITIONS;
  return ["DH", ...FIELD_POSITIONS.filter((p) => p !== "P")];
}

function positionBadge(pos: Position) {
  const num = POSITION_NUMBERS[pos];
  return (
    <>
      {num > 0 ? <span className="font-bold tabular-nums text-[#f5c518]">{num}</span> : null}
      <span className="font-bold text-[#f5c518]">{POSITION_SHORT[pos]}</span>
      {" "}
      {POSITION_LABELS[pos]}
    </>
  );
}

export function LineupBoard({
  lineup,
  bench,
  useDh = false,
  pitcher,
  onReplace,
  onMoveOrder,
  onPosition,
  onRename,
  onPitcherChange,
}: {
  lineup: LineupSlot[];
  bench: Player[];
  useDh?: boolean;
  pitcher?: PitcherOnly;
  onReplace: (order: number, player: Player) => void;
  onMoveOrder: (fromOrder: number, toOrder: number) => void;
  onPosition: (order: number, position: Position) => void;
  onRename: (order: number, name: string) => void;
  onPitcherChange?: (pitcher: PitcherOnly) => void;
}) {
  const [swapFrom, setSwapFrom] = useState<number | null>(null);
  const [benchId, setBenchId] = useState<string | null>(null);
  const [posOrder, setPosOrder] = useState<number | null>(null);
  const [editPitcher, setEditPitcher] = useState(false);
  const posSlot = lineup.find((s) => s.order === posOrder) ?? null;
  const choices = positionChoices(useDh);

  function slotAt(pos: Position): LineupSlot | undefined {
    if (useDh && pos === "P" && pitcher) {
      return { order: PITCHER_ORDER, position: "P", ...pitcher };
    }
    return lineup.find((s) => s.position === pos);
  }

  function clearPicks() {
    setSwapFrom(null);
    setBenchId(null);
  }

  function tapRow(order: number) {
    if (benchId) {
      const player = bench.find((p) => p.id === benchId);
      if (player) onReplace(order, player);
      clearPicks();
      return;
    }
    if (swapFrom == null) {
      setSwapFrom(order);
      return;
    }
    if (swapFrom === order) {
      setSwapFrom(null);
      return;
    }
    onMoveOrder(swapFrom, order);
    clearPicks();
  }

  function hint() {
    if (benchId) {
      const p = bench.find((b) => b.id === benchId);
      return `${p?.name ?? "控え"} を出す打順をタップしてください`;
    }
    if (swapFrom != null) {
      const s = lineup.find((x) => x.order === swapFrom);
      return `${swapFrom}番 ${s?.playerName ?? ""} と入れ替える打順をタップ`;
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {useDh ? (
        <p className="rounded-xl border border-[#f5c518]/40 bg-[#1a281c] px-3 py-2 text-sm text-[#f5c518] font-bold">
          DH制：投手は打席に立たず、指名打者が打ちます
        </p>
      ) : null}

      <section>
        <h3 className="font-bold text-lg">打順</h3>
        <p className="text-sm text-[#9aa894] mt-1 leading-relaxed">
          右の <span className="text-[#f5c518] font-bold">▲▼</span> で1つずつ入れ替え。選手のカードをタップしてから、入れ替えたい相手をタップしてもOKです。
        </p>
        {hint() ? (
          <div className="mt-2 rounded-xl border border-[#f5c518] bg-[#1a281c] px-3 py-2 flex items-center gap-2">
            <p className="flex-1 text-sm text-[#f5c518] font-bold">{hint()}</p>
            <button type="button" className="text-sm underline" onClick={clearPicks}>
              キャンセル
            </button>
          </div>
        ) : null}

        <ol className="flex flex-col gap-2 mt-3">
          {lineup.map((slot, index) => {
            const selected = swapFrom === slot.order;
            const profile = playerProfileLabel(slot);
            return (
              <li
                key={slot.order}
                className={`rounded-2xl border p-2 bg-[#121a14] ${selected ? "border-[#f5c518] bg-[#1a281c]" : "border-[#2c3c30]"}`}
              >
                <div className="flex items-stretch gap-2">
                  <button
                    type="button"
                    className={`tap w-14 px-0 text-xl ${selected ? "tap-accent" : ""}`}
                    onClick={() => tapRow(slot.order)}
                    aria-label={`${slot.order}番を選ぶ`}
                  >
                    {slot.order}
                  </button>
                  <div className="flex-1 min-w-0">
                    <ImeTextInput
                      className="tap w-full px-3 bg-[#070a08] min-h-12"
                      lang="ja"
                      autoCapitalize="off"
                      autoComplete="off"
                      enterKeyHint="done"
                      value={slot.playerName}
                      onCommit={(name) => onRename(slot.order, name)}
                      aria-label={`${slot.order}番の名前`}
                    />
                    <button
                      type="button"
                      className="mt-1 text-left text-sm text-[#9aa894] px-1"
                      onClick={() => setPosOrder(slot.order)}
                    >
                      {slot.number ? `背番号 ${slot.number} · ` : ""}
                      {POSITION_SHORT[slot.position]} {POSITION_LABELS[slot.position]}
                      {profile ? ` · ${profile}` : ""}
                      {" · 守備を変更"}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 w-12 shrink-0">
                    <button
                      type="button"
                      className="h-11 rounded-xl border border-[#2c3c30] bg-[#070a08] text-lg font-bold disabled:opacity-30"
                      disabled={index === 0}
                      onClick={() => onMoveOrder(slot.order, slot.order - 1)}
                      aria-label="打順を上げる"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      className="h-11 rounded-xl border border-[#2c3c30] bg-[#070a08] text-lg font-bold disabled:opacity-30"
                      disabled={index === lineup.length - 1}
                      onClick={() => onMoveOrder(slot.order, slot.order + 1)}
                      aria-label="打順を下げる"
                    >
                      ▼
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {useDh && pitcher && onPitcherChange ? (
        <section>
          <h3 className="font-bold text-lg">投手（打順外）</h3>
          <p className="text-sm text-[#9aa894] mt-1">DH制では投手は守備のみです。</p>
          <div className="mt-2 rounded-2xl border border-[#f5c518]/50 bg-[#121a14] p-3 flex flex-col gap-2">
            <ImeTextInput
              className="tap w-full px-3 bg-[#070a08] min-h-12"
              lang="ja"
              autoCapitalize="off"
              autoComplete="off"
              enterKeyHint="done"
              value={pitcher.playerName}
              onCommit={(name) => onPitcherChange({ ...pitcher, playerName: name })}
              aria-label="投手の名前"
            />
            <div className="flex flex-wrap gap-2">
              {bench.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="tap px-3 text-sm"
                  onClick={() =>
                    onPitcherChange({
                      playerId: p.id,
                      playerName: p.name,
                      number: p.number,
                      throws: p.throws,
                      bats: p.bats,
                      ageKind: p.ageKind,
                      grade: p.grade,
                      age: p.age,
                    })
                  }
                >
                  {p.number ? `${p.number} ` : ""}
                  {p.name} を投手に
                </button>
              ))}
              <button type="button" className="tap px-3 text-sm" onClick={() => setEditPitcher(true)}>
                詳細
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="font-bold text-lg">ベンチ</h3>
        <p className="text-sm text-[#9aa894] mt-1">控えをタップしてから、出す打順をタップします。</p>
        {bench.length === 0 ? (
          <p className="text-sm text-[#9aa894] mt-2">控えはいません。相手側は下の名簿コードも使えます。</p>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`tap px-3 ${benchId === p.id ? "tap-accent" : ""}`}
                onClick={() => {
                  setSwapFrom(null);
                  setBenchId((id) => (id === p.id ? null : p.id));
                }}
              >
                {p.number ? `${p.number} ` : ""}
                {p.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-bold text-lg">守備位置</h3>
        <p className="text-sm text-[#9aa894] mt-1">
          {useDh
            ? "選手をタップすると守備位置を変えられます。投手は上の「投手（打順外）」から変更します。"
            : "選手をタップすると守備位置を変えられます。"}
        </p>
        <div className="rounded-2xl border border-[#2c3c30] bg-[#0d140f] p-3 mt-2">
          <div className="grid grid-cols-6 grid-rows-5 gap-2">
            {FIELD.map(({ pos, className }) => {
              const slot = slotAt(pos);
              return (
                <button
                  key={pos}
                  type="button"
                  className={`tap min-h-14 px-1 text-xs ${className}`}
                  onClick={() => {
                    if (useDh && pos === "P") {
                      setEditPitcher(true);
                      return;
                    }
                    if (slot && slot.order !== PITCHER_ORDER) setPosOrder(slot.order);
                  }}
                >
                  <span className="block text-[10px] opacity-70">{positionBadge(pos)}</span>
                  <span className="font-bold">{slot?.playerName ?? "空き"}</span>
                </button>
              );
            })}
          </div>
        </div>
        {useDh ? (
          <p className="text-sm text-[#9aa894] mt-2">
            指名打者（
            {lineup.find((s) => s.position === "DH")?.playerName ?? "未設定"}
            ）は守備に就きません。
          </p>
        ) : null}
      </section>

      {posSlot ? (
        <Sheet title={`${posSlot.order}番 ${posSlot.playerName} の守備`} onClose={() => setPosOrder(null)}>
          <p className="text-sm text-[#9aa894] mb-3">守備位置を選ぶと、その位置の選手と入れ替わります。</p>
          <div className="grid grid-cols-3 gap-2">
            {choices.map((pos) => (
              <button
                key={pos}
                type="button"
                className={`tap tap-result text-sm ${posSlot.position === pos ? "tap-accent" : ""}`}
                onClick={() => {
                  onPosition(posSlot.order, pos);
                  setPosOrder(null);
                }}
              >
                {positionBadge(pos)}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {editPitcher && pitcher && onPitcherChange ? (
        <Sheet title="投手（打順外）" onClose={() => setEditPitcher(false)}>
          <p className="text-sm text-[#9aa894] mb-3">DH制の投手は打席に立ちません。</p>
          <ImeTextInput
            className="tap w-full px-3 bg-[#070a08] min-h-12 mb-3"
            lang="ja"
            autoCapitalize="off"
            autoComplete="off"
            enterKeyHint="done"
            value={pitcher.playerName}
            onCommit={(name) => onPitcherChange({ ...pitcher, playerName: name })}
            aria-label="投手の名前"
          />
          <div className="flex flex-col gap-2">
            {bench.map((p) => (
              <button
                key={p.id}
                type="button"
                className="tap tap-result w-full"
                onClick={() => {
                  onPitcherChange({
                    playerId: p.id,
                    playerName: p.name,
                    number: p.number,
                    throws: p.throws,
                    bats: p.bats,
                    ageKind: p.ageKind,
                    grade: p.grade,
                    age: p.age,
                  });
                  setEditPitcher(false);
                }}
              >
                {p.number ? `${p.number} ` : ""}
                {p.name}
              </button>
            ))}
          </div>
          <button type="button" className="tap tap-accent w-full mt-3" onClick={() => setEditPitcher(false)}>
            完了
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}
