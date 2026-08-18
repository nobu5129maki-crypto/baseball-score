"use client";

import { POSITION_SHORT } from "@/lib/types";
import type { Scorebook, ScorebookOrder, ScorebookPlayer } from "@/lib/scorebook";

const VIA: Record<ScorebookPlayer["via"], string> = {
  start: "",
  ph: "代打",
  pr: "代走",
  sub: "交代",
};

export function ScorebookView({
  title,
  side,
  innings,
}: {
  title: string;
  side: Scorebook["first"];
  innings: number;
}) {
  const hasMarks = side.orders.some((row) => row.innings.some((cell) => cell.length > 0));

  return (
    <section className="scorebook-team">
      <h3 className="font-bold mb-2">{title}</h3>
      {!hasMarks ? (
        <p className="text-sm text-[#9aa894] mb-2">このチームの打席記録はまだありません。</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="scorebook-table w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="scorebook-name">打順</th>
              {Array.from({ length: innings }, (_, i) => (
                <th key={i} className="scorebook-inning">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {side.orders.map((row) => (
              <tr key={row.order}>
                <td className="scorebook-name text-left align-top">
                  <OrderNames row={row} />
                </td>
                {row.innings.map((cell, col) => (
                  <td key={col} className="scorebook-cell align-top">
                    {cell.length === 0 ? (
                      <span className="scorebook-empty">　</span>
                    ) : (
                      cell.map((m, i) => (
                        <div key={`${m.label}-${i}`} className={`leading-tight ${m.hit ? "scorebook-hit" : ""}`}>
                          {m.label}
                        </div>
                      ))
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OrderNames({ row }: { row: ScorebookOrder }) {
  return (
    <div className="flex flex-col gap-0.5">
      {row.players.map((p, i) => {
        const via = VIA[p.via];
        return (
          <div key={`${p.playerId}-${i}`} className="leading-tight">
            {i === 0 ? (
              <>
                <span className="font-bold">{row.order}</span>{" "}
                <span className="font-bold">{p.name}</span>{" "}
                <span className="text-[#9aa894]">{POSITION_SHORT[p.position]}</span>
              </>
            ) : (
              <>
                {via ? <span className="text-[#9aa894]">{via} </span> : null}
                <span className="font-bold">{p.name}</span>{" "}
                <span className="text-[#9aa894]">{POSITION_SHORT[p.position]}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
