"use client";

import { BATS_OPTIONS, GRADE_OPTIONS, parseAgeInput, THROWS_OPTIONS } from "@/lib/player-profile";
import type { AgeKind, PlayerProfile } from "@/lib/types";

export function PlayerProfileFields({
  value,
  onChange,
}: {
  value: PlayerProfile;
  onChange: (next: PlayerProfile) => void;
}) {
  const ageKind: AgeKind = value.ageKind === "age" ? "age" : "grade";

  function patch(partial: PlayerProfile) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="flex flex-col gap-3">
      <fieldset>
        <legend className="text-sm text-[#9aa894] mb-1">投げる手</legend>
        <div className="grid grid-cols-2 gap-2">
          {THROWS_OPTIONS.map((opt) => (
            <Choice
              key={opt.value}
              label={opt.label}
              selected={value.throws === opt.value}
              onClick={() => patch({ throws: toggle(value.throws, opt.value) })}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm text-[#9aa894] mb-1">打席</legend>
        <div className="grid grid-cols-3 gap-2">
          {BATS_OPTIONS.map((opt) => (
            <Choice
              key={opt.value}
              label={opt.label}
              selected={value.bats === opt.value}
              onClick={() => patch({ bats: toggle(value.bats, opt.value) })}
            />
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm text-[#9aa894] mb-1">学年または年齢</legend>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Choice
            label="学年"
            selected={ageKind === "grade"}
            onClick={() => patch({ ageKind: "grade" })}
          />
          <Choice
            label="年齢"
            selected={ageKind === "age"}
            onClick={() => patch({ ageKind: "age" })}
          />
        </div>
        {ageKind === "grade" ? (
          <select
            className="tap px-3 bg-[#121a14] w-full"
            value={value.grade ?? ""}
            onChange={(e) => patch({ ageKind: "grade", grade: e.target.value || undefined })}
            aria-label="学年"
          >
            <option value="">未設定</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        ) : (
          <input
            className="tap px-3 bg-[#121a14] w-full"
            inputMode="numeric"
            placeholder="年齢"
            value={value.age == null ? "" : String(value.age)}
            onChange={(e) => patch({ ageKind: "age", age: parseAgeInput(e.target.value) })}
            aria-label="年齢"
          />
        )}
      </fieldset>
    </div>
  );
}

function Choice({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`tap text-sm ${selected ? "tap-accent" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function toggle<T>(current: T | undefined, next: T): T | undefined {
  return current === next ? undefined : next;
}
