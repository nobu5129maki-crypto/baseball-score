"use client";

import { POSITION_LABELS, POSITION_SHORT } from "@/lib/types";
import type { Position } from "@/lib/types";
import { Sheet } from "./Sheet";

/** 本塁を下にした守備位置図。遊撃は三塁と投手の間、二塁は投手と一塁の間 */
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

export function PositionPicker({
  title,
  onPick,
  onClose,
}: {
  title: string;
  onPick: (pos: Position) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose} tall>
      <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
        本塁から見て、打球が飛んだ場所をタップしてください。図の上側が外野です。
      </p>

      <div className="relative rounded-2xl border border-[#2c3c30] bg-[#0d140f] overflow-hidden mb-2">
        {/* 芝と内野のざっくりしたグラウンド */}
        <div
          className="absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 120% 70% at 50% 18%, #1f4a2a 0%, #14351c 45%, #0d140f 75%), radial-gradient(circle at 50% 72%, #5a4630 0%, #5a4630 14%, transparent 15%)",
          }}
        />
        <svg
          className="absolute inset-x-[18%] top-[42%] bottom-[8%] opacity-25"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <polygon points="50,8 92,50 50,92 8,50" fill="none" stroke="#f5c518" strokeWidth="1.5" />
          <circle cx="50" cy="50" r="7" fill="none" stroke="#f5c518" strokeWidth="1.2" />
        </svg>

        <div className="relative p-3 pt-4">
          <p className="text-center text-[11px] font-bold text-[#9aa894] tracking-widest mb-2">外野</p>
          <div className="grid grid-cols-6 grid-rows-5 gap-2">
            {FIELD.map(({ pos, className }) => (
              <button
                key={pos}
                type="button"
                className={`tap tap-result min-h-[4.25rem] px-1 flex flex-col items-center justify-center gap-0.5 ${className} ${
                  pos === "P" ? "ring-1 ring-[#f5c518]/60" : ""
                }`}
                onClick={() => onPick(pos)}
              >
                <span className="text-base font-bold leading-none text-[#f5c518]">{POSITION_SHORT[pos]}</span>
                <span className="text-xs font-bold leading-tight text-center">{POSITION_LABELS[pos]}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-col items-center gap-1">
            <span
              className="inline-block w-0 h-0 border-l-[10px] border-r-[10px] border-b-[14px] border-l-transparent border-r-transparent border-b-[#f5c518]"
              aria-hidden
            />
            <p className="text-xs font-bold text-[#f5c518]">本塁（打席側）</p>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
