"use client";

import { inningLabel, totalRuns } from "@/lib/engine";
import type { Dest, GameState, RunnerOnBase } from "@/lib/types";
import { CountDots } from "./CountDots";

type Props = {
  state: GameState;
  selectedId: string | null;
  edit: boolean;
  showOutButton?: boolean;
  displayBases?: GameState["bases"];
  pitcherName?: string;
  onSelectRunner: (runner: RunnerOnBase, from: 0 | 1 | 2 | 3) => void;
  onSelectDest: (to: Dest) => void;
};

export function DiamondMap({
  state,
  selectedId,
  edit,
  showOutButton,
  displayBases,
  pitcherName,
  onSelectRunner,
  onSelectDest,
}: Props) {
  const shown = displayBases ?? state.bases;
  const firstRuns = totalRuns(state.scores.first);
  const secondRuns = totalRuns(state.scores.second);
  const fielding = state.half === "top" ? "second" : "first";
  const pitchTotal = state.pitchesThrown[fielding];
  const bases: Array<{
    loc: 1 | 2 | 3;
    x: number;
    y: number;
    nameSide: "top" | "right" | "left";
    runner: RunnerOnBase | null;
  }> = [
    { loc: 2, x: 170, y: 46, nameSide: "top", runner: shown[1] },
    { loc: 1, x: 266, y: 142, nameSide: "right", runner: shown[0] },
    { loc: 3, x: 74, y: 142, nameSide: "left", runner: shown[2] },
  ];

  return (
    <div className="px-2 py-1">
      <div className="flex items-end justify-between px-1 mb-1">
        <p className="text-xl font-bold leading-none">{inningLabel(state.inning, state.half)}</p>
        <p className="text-xl font-bold leading-none tabular-nums">
          {firstRuns} − {secondRuns}
        </p>
      </div>
      <svg viewBox="-12 0 364 252" className="w-full max-h-56">
        <polygon
          points="170,54 258,142 170,230 82,142"
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
            nameSide={b.nameSide}
            runner={b.runner}
            selected={selectedId === b.runner?.playerId}
            onClick={() => {
              if (b.runner) onSelectRunner(b.runner, b.loc);
              else if (edit) onSelectDest(b.loc);
            }}
          />
        ))}
        <BasePad
          x={170}
          y={230}
          label="本"
          runner={null}
          selected={false}
          onClick={() => {
            if (edit) onSelectDest(4);
          }}
        />
      </svg>
      <div className="mt-1">
        <CountDots balls={state.balls} strikes={state.strikes} outs={state.outs} />
      </div>
      {pitcherName ? (
        <p className="text-center text-xs text-[#9aa894] mt-1">
          今の投手 {pitcherName} {pitchTotal}球 · この打席 {state.pitchCountAtBat}球
        </p>
      ) : null}
      {showOutButton ? (
        <div className="flex gap-2 px-1 mt-2">
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
  nameSide,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  runner: RunnerOnBase | null;
  selected: boolean;
  nameSide?: "top" | "right" | "left";
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
      {runner && nameSide ? <RunnerName x={x} y={y} name={runner.playerName} side={nameSide} /> : null}
    </g>
  );
}

function RunnerName({
  x,
  y,
  name,
  side,
}: {
  x: number;
  y: number;
  name: string;
  side: "top" | "right" | "left";
}) {
  const short = name.length > 4 ? name.slice(0, 4) : name;
  const w = Math.max(28, short.length * 11 + 10);
  const h = 16;
  const tx = side === "right" ? x + 26 : side === "left" ? x - 26 : x;
  const ty = side === "top" ? y - 26 : y + 5;
  const anchor = side === "right" ? "start" : side === "left" ? "end" : "middle";
  const bx = side === "top" ? tx - w / 2 : side === "right" ? tx - 4 : tx - w + 4;
  const by = ty - 12;
  return (
    <g>
      <rect x={bx} y={by} width={w} height={h} rx="4" fill="#070a08" fillOpacity="0.92" />
      <text x={tx} y={ty} textAnchor={anchor} fill="#3ddc84" fontSize="11" fontWeight="700">
        {short}
      </text>
    </g>
  );
}
