import type { GameState } from "@/lib/types";

export function BsopBar({ state }: { state: GameState }) {
  return (
    <div className="px-3 py-2 border-b border-[#2c3c30] flex items-center justify-between gap-3">
      <div className="flex gap-4 text-sm font-bold">
        <CountGroup label="B" color="var(--ball)" filled={state.balls} total={3} />
        <CountGroup label="S" color="var(--strike)" filled={state.strikes} total={2} />
        <CountGroup label="O" color="var(--out)" filled={state.outs} total={2} />
      </div>
      <p className="text-xs text-[#9aa894]">この打席 {state.pitchCountAtBat}球</p>
    </div>
  );
}

function CountGroup({
  label,
  color,
  filled,
  total,
}: {
  label: string;
  color: string;
  filled: number;
  total: number;
}) {
  return (
    <span className="flex items-center gap-1.5" style={{ color }}>
      <span>{label}</span>
      {Array.from({ length: total }, (_, i) => (
        <span key={`${label}-${i}`} className={`dot ${i < filled ? "on" : ""}`} />
      ))}
    </span>
  );
}
