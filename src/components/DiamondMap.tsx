"use client";

import type { Dest, GameState, RunnerOnBase } from "@/lib/types";

type Props = {
  state: GameState;
  batterName: string;
  selectedId: string | null;
  edit: boolean;
  displayBases?: GameState["bases"];
  onSelectRunner: (runner: RunnerOnBase, from: 0 | 1 | 2 | 3) => void;
  onSelectDest: (to: Dest) => void;
};

export function DiamondMap({
  state,
  batterName,
  selectedId,
  edit,
  displayBases,
  onSelectRunner,
  onSelectDest,
}: Props) {
  const shown = displayBases ?? state.bases;
  const bases: Array<{
    loc: 1 | 2 | 3;
    x: number;
    y: number;
    runner: RunnerOnBase | null;
  }> = [
    { loc: 2, x: 120, y: 28, runner: shown[1] },
    { loc: 1, x: 200, y: 110, runner: shown[0] },
    { loc: 3, x: 40, y: 110, runner: shown[2] },
  ];

  return (
    <div className="px-2 py-1">
      <svg viewBox="0 0 240 210" className="w-full max-h-52">
        <polygon
          points="120,36 192,110 120,184 48,110"
          fill="none"
          stroke="#2c3c30"
          strokeWidth="2"
        />
        {bases.map((b) => (
          <BasePad
            key={b.loc}
            x={b.x}
            y={b.y}
            label={String(b.loc)}
            runner={b.runner}
            selected={selectedId === b.runner?.playerId}
            onClick={() => {
              if (b.runner) onSelectRunner(b.runner, b.loc);
              else if (edit) onSelectDest(b.loc);
            }}
          />
        ))}
        <BasePad
          x={120}
          y={184}
          label="本"
          runner={null}
          selected={false}
          batterName={batterName}
          onClick={() => {
            if (edit) onSelectDest(4);
          }}
        />
      </svg>
      {edit ? (
        <div className="flex gap-2 px-1">
          <button type="button" className="tap tap-danger flex-1 text-sm" onClick={() => onSelectDest("out")}>
            アウトにする
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BasePad({
  x,
  y,
  label,
  runner,
  selected,
  batterName,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  runner: RunnerOnBase | null;
  selected: boolean;
  batterName?: string;
  onClick: () => void;
}) {
  const occupied = Boolean(runner);
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      <rect
        x={x - 16}
        y={y - 16}
        width={32}
        height={32}
        rx="4"
        transform={`rotate(45 ${x} ${y})`}
        fill={selected ? "#f5c518" : occupied ? "#1e3d28" : "#121a14"}
        stroke={selected ? "#f5c518" : occupied ? "#3ddc84" : "#2c3c30"}
        strokeWidth="2"
      />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fill={selected ? "#14180c" : "#f4f7f0"}
        fontSize="11"
        fontWeight="700"
      >
        {label}
      </text>
      {runner ? (
        <text x={x} y={y + 28} textAnchor="middle" fill="#3ddc84" fontSize="10">
          {runner.playerName}
        </text>
      ) : null}
      {batterName && label === "本" ? (
        <text x={x} y={y + 28} textAnchor="middle" fill="#9aa894" fontSize="10">
          {batterName}
        </text>
      ) : null}
    </g>
  );
}
