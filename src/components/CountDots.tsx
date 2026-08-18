export function CountDots({
  balls,
  strikes,
  outs,
}: {
  balls: number;
  strikes: number;
  outs: number;
}) {
  return (
    <div className="flex justify-center gap-4 text-sm font-bold">
      <CountGroup label="B" color="var(--ball)" filled={balls} total={3} />
      <CountGroup label="S" color="var(--strike)" filled={strikes} total={2} />
      <CountGroup label="O" color="var(--out)" filled={outs} total={2} />
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
