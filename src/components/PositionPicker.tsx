"use client";

import { POSITION_LABELS } from "@/lib/types";
import type { Position } from "@/lib/types";
import { Sheet } from "./Sheet";

const FIELD: Position[][] = [
  ["LF", "CF", "RF"],
  ["3B", "SS", "2B"],
  ["P", "C", "1B"],
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
      <div className="flex flex-col gap-2">
        {FIELD.map((row) => (
          <div key={row.join("-")} className="grid grid-cols-3 gap-2">
            {row.map((pos) => (
              <button key={pos} type="button" className="tap tap-result" onClick={() => onPick(pos)}>
                {POSITION_LABELS[pos]}
              </button>
            ))}
          </div>
        ))}
      </div>
    </Sheet>
  );
}
