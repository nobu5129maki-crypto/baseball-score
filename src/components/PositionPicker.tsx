"use client";

import { POSITION_LABELS, POSITIONS } from "@/lib/types";
import type { Position } from "@/lib/types";
import { Sheet } from "./Sheet";

const FIELD: Array<{ pos: Position; className: string }> = [
  { pos: "CF", className: "col-start-2 row-start-1" },
  { pos: "LF", className: "col-start-1 row-start-2" },
  { pos: "RF", className: "col-start-3 row-start-2" },
  { pos: "SS", className: "col-start-1 row-start-3 justify-self-end mr-2" },
  { pos: "2B", className: "col-start-3 row-start-3 justify-self-start ml-2" },
  { pos: "3B", className: "col-start-1 row-start-4" },
  { pos: "P", className: "col-start-2 row-start-4" },
  { pos: "1B", className: "col-start-3 row-start-4" },
  { pos: "C", className: "col-start-2 row-start-5" },
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
    <Sheet title={title} onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-3">打球が行った守備位置を選んでください</p>
      <div className="grid grid-cols-3 grid-rows-5 gap-2 place-items-center py-2">
        {FIELD.map(({ pos, className }) => (
          <button
            key={pos}
            type="button"
            className={`tap tap-result w-full ${className}`}
            onClick={() => onPick(pos)}
          >
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        {POSITIONS.map((pos) => (
          <button key={`list-${pos}`} type="button" className="tap text-xs min-h-12" onClick={() => onPick(pos)}>
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
