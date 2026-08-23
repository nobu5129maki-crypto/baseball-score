"use client";

import { clockTime, gameTimeLabel } from "@/lib/game-time";

export function GameTimeFields({
  startTime,
  endTime,
  onChange,
}: {
  startTime?: string;
  endTime?: string;
  onChange: (next: { startTime?: string; endTime?: string }) => void;
}) {
  const label = gameTimeLabel({ startTime, endTime });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <TimeField
          label="開始時間"
          value={startTime ?? ""}
          onChange={(value) => onChange({ startTime: value, endTime })}
        />
        <TimeField
          label="終了時間"
          value={endTime ?? ""}
          onChange={(value) => onChange({ startTime, endTime: value })}
        />
      </div>
      {label ? <p className="text-sm text-[#9aa894]">{label}</p> : null}
    </div>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-[#9aa894]">{label}</span>
      <div className="flex gap-2">
        <input
          type="time"
          className="tap px-3 bg-[#121a14] flex-1 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button type="button" className="tap px-3 text-sm shrink-0" onClick={() => onChange(clockTime())}>
          今
        </button>
      </div>
    </label>
  );
}
