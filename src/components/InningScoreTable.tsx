import { totalRuns } from "@/lib/engine";
import { displayInnings, lineScoreCells } from "@/lib/scorebook";
import type { Game, GameState } from "@/lib/types";

export function InningScoreTable({
  game,
  state,
  firstName,
  secondName,
}: {
  game: Game;
  state: GameState;
  firstName: string;
  secondName: string;
}) {
  const liveInning = state.ended ? 0 : state.inning;
  const cols = displayInnings(game, liveInning);
  const headers = Array.from({ length: cols }, (_, i) => String(i + 1));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-center text-sm border-collapse">
        <thead>
          <tr className="text-[#9aa894]">
            <th className="p-1 text-left font-medium"> </th>
            {headers.map((h) => (
              <th key={h} className="p-1 font-medium min-w-8">
                {h}
              </th>
            ))}
            <th className="p-1 font-bold">R</th>
            <th className="p-1">H</th>
            <th className="p-1">E</th>
          </tr>
        </thead>
        <tbody>
          <ScoreRow
            name={firstName}
            innings={lineScoreCells(state.scores.first, cols, "first", game, state)}
            r={totalRuns(state.scores.first)}
            h={state.hits.first}
            e={state.errors.first}
            active={!state.ended && state.half === "top"}
          />
          <ScoreRow
            name={secondName}
            innings={lineScoreCells(state.scores.second, cols, "second", game, state)}
            r={totalRuns(state.scores.second)}
            h={state.hits.second}
            e={state.errors.second}
            active={!state.ended && state.half === "bottom" && !state.bottomUnplayed}
          />
        </tbody>
      </table>
    </div>
  );
}

function ScoreRow({
  name,
  innings,
  r,
  h,
  e,
  active,
}: {
  name: string;
  innings: Array<number | "X" | null>;
  r: number;
  h: number;
  e: number;
  active: boolean;
}) {
  return (
    <tr className={active ? "bg-[#1a281c]" : ""}>
      <td className={`p-1 text-left font-bold truncate max-w-24 ${active ? "text-[#f5c518]" : ""}`}>
        {active ? "攻 " : ""}
        {name}
      </td>
      {innings.map((v, i) => (
        <td key={`${name}-${i}`} className="p-1">
          {v === null ? "·" : v}
        </td>
      ))}
      <td className="p-1 font-bold">{r}</td>
      <td className="p-1">{h}</td>
      <td className="p-1">{e}</td>
    </tr>
  );
}
