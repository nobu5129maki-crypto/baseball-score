"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  commitEnd,
  commitPb,
  commitPickoff,
  commitPinchRunner,
  commitPitch,
  commitPlay,
  commitSteal,
  commitSub,
  commitWp,
  battingSide,
  getBatter,
  getLineup,
  getPitcher,
  inningLabel,
  needsFieldPosition,
  needsRunnerConfirm,
  previewAfterMoves,
  proposeMoves,
  reduceGame,
  totalRuns,
  undoAtBat,
  undoLast,
} from "@/lib/engine";
import { db, getSettings, saveGame } from "@/lib/db";
import { HIT_RESULTS, OTHER_RESULTS, OUT_RESULTS, PLAY_LABELS } from "@/lib/labels";
import { batterLine, slashFor } from "@/lib/stats";
import { POSITION_LABELS } from "@/lib/types";
import type { Base, Dest, Game, PlayResult, Position, RunnerMove, RunnerOnBase, Side } from "@/lib/types";
import { BsopBar } from "./BsopBar";
import { DiamondMap } from "./DiamondMap";
import { GlossarySheet } from "./GlossarySheet";
import { InningScoreTable } from "./InningScoreTable";
import { PositionPicker } from "./PositionPicker";
import { Sheet } from "./Sheet";

type SheetKind =
  | null
  | "hit"
  | "out"
  | "other"
  | "menu"
  | "sub"
  | "glossary"
  | "steal"
  | "cs"
  | "pickoff"
  | "pr"
  | "field";

export function ScoreScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const players = useLiveQuery(async () => {
    const g = await db.games.get(gameId);
    if (!g) return [];
    return db.players.where("teamId").equals(g.myTeamId).toArray();
  }, [gameId]);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [glossaryId, setGlossaryId] = useState<string | "index">("index");
  const [pendingResult, setPendingResult] = useState<PlayResult | null>(null);
  const [confirm, setConfirm] = useState<{
    result: PlayResult;
    moves: RunnerMove[];
    field?: Position;
    selectedId: string | null;
  } | null>(null);
  const [leftHanded, setLeftHanded] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => setLeftHanded(s.leftHanded));
  }, []);

  const state = useMemo(() => (game ? reduceGame(game) : null), [game]);

  if (game === undefined) {
    return <p className="p-6 text-[#9aa894]">読み込み中…</p>;
  }
  if (!game || !state) {
    return (
      <main className="p-6">
        <p>試合が見つかりません。</p>
        <Link href="/" className="tap tap-accent px-4 inline-flex items-center mt-4">
          ホームへ
        </Link>
      </main>
    );
  }

  const batter = getBatter(state);
  const pitcher = getPitcher(state);
  const firstName = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const secondName = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const occupiedCount = state.bases.filter(Boolean).length;
  const slash = slashFor(game, batter.playerId);
  const people = confirmPeople(state, batter.playerId, batter.playerName, confirm?.moves ?? []);
  const preview = confirm
    ? previewAfterMoves(state, confirm.moves, batter)
    : null;

  async function patch(mut: (g: Game) => Game) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    await saveGame(mut(latest));
  }

  function startResult(result: PlayResult) {
    setSheet(null);
    if (!state) return;
    if (needsFieldPosition(result)) {
      setPendingResult(result);
      setSheet("field");
      return;
    }
    finishResult(result);
  }

  function finishResult(result: PlayResult, field?: Position) {
    if (!state) return;
    const moves = proposeMoves(result, state, batter);
    if (needsRunnerConfirm(result, state)) {
      setConfirm({ result, moves, field, selectedId: null });
      return;
    }
    void patch((g) => commitPlay(g, result, moves, field));
  }

  function setMove(playerId: string, from: 0 | 1 | 2 | 3, to: Dest) {
    if (!confirm) return;
    const rest = confirm.moves.filter((m) => m.playerId !== playerId);
    setConfirm({
      ...confirm,
      moves: [...rest, { playerId, from, to }],
      selectedId: null,
    });
  }

  function onSelectRunner(runner: RunnerOnBase, from: 0 | 1 | 2 | 3) {
    if (from === 0) return;
    if (sheet === "steal") {
      const to: Dest = from === 3 ? 4 : ((from + 1) as Dest);
      void patch((g) => commitSteal(g, from, to));
      setSheet(null);
      return;
    }
    if (sheet === "cs") {
      void patch((g) => commitSteal(g, from, "out"));
      setSheet(null);
      return;
    }
    if (sheet === "pickoff") {
      void patch((g) => commitPickoff(g, from));
      setSheet(null);
      return;
    }
    if (!confirm) return;
    setConfirm({ ...confirm, selectedId: runner.playerId });
  }

  function onSelectDest(to: Dest) {
    if (!confirm || !state) return;
    if (confirm.selectedId) {
      const selected = confirm.selectedId;
      const from =
        confirm.moves.find((m) => m.playerId === selected)?.from ??
        ((state.bases.findIndex((b) => b?.playerId === selected) + 1 || 0) as 0 | 1 | 2 | 3);
      setMove(selected, from, to);
      return;
    }
    const batterMove = confirm.moves.find((m) => m.from === 0);
    if (batterMove) setMove(batterMove.playerId, 0, to);
  }

  return (
    <main className="flex flex-col min-h-dvh max-w-lg mx-auto w-full">
      <header className="flex items-center gap-2 px-2 py-2 min-h-14 border-b border-[#2c3c30]">
        <Link href="/" className="tap tap-ghost px-3 text-sm">
          ←
        </Link>
        <div className="flex-1 text-center">
          <p className="font-bold">{inningLabel(state.inning, state.half)}</p>
          <p className="text-sm">
            <span className={state.half === "top" ? "text-[#f5c518] font-bold" : "text-[#9aa894]"}>
              {state.half === "top" ? "攻 " : ""}
              {firstName} {totalRuns(state.scores.first)}
            </span>
            <span> — </span>
            <span className={state.half === "bottom" ? "text-[#f5c518] font-bold" : "text-[#9aa894]"}>
              {totalRuns(state.scores.second)} {secondName}
              {state.half === "bottom" ? " 攻" : ""}
            </span>
          </p>
        </div>
        <button type="button" className="tap tap-ghost px-3 text-sm" onClick={() => setSheet("menu")}>
          ⋯
        </button>
      </header>

      <BsopBar state={state} pitcherName={pitcher?.playerName} />

      <div className="mx-3 my-2 rounded-2xl border-2 border-[#f5c518] bg-[#1a281c] px-3 py-3">
        <p className="text-[11px] text-[#f5c518] font-bold tracking-wide">
          {state.half === "top" ? firstName : secondName} の攻撃
        </p>
        <p className="text-2xl font-bold leading-tight mt-0.5 break-words">
          {batter.order}番 {batter.playerName}
        </p>
        <p className="text-sm text-[#d5dccf]">{POSITION_LABELS[batter.position]}</p>
        <p className="text-sm text-[#f5c518] mt-1">{slash ? batterLine(slash) : "今試合 まだ打席なし"}</p>
      </div>

      <DiamondMap
        state={state}
        batterName={batter.playerName}
        selectedId={confirm?.selectedId ?? null}
        edit={Boolean(confirm) || sheet === "steal" || sheet === "cs" || sheet === "pickoff"}
        onSelectRunner={onSelectRunner}
        onSelectDest={onSelectDest}
      />

      {confirm ? (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-sm text-[#f5c518]">進塁先を直してから確定（走者をタップ→塁をタップ）</p>
          {preview ? (
            <p className="text-xs text-[#d5dccf]">
              確定後: 1塁 {preview.bases[0]?.playerName ?? "なし"} / 2塁 {preview.bases[1]?.playerName ?? "なし"} / 3塁{" "}
              {preview.bases[2]?.playerName ?? "なし"}
              {preview.scored.length ? ` / 生還 ${preview.scored.join("・")}` : ""}
              {preview.outs.length ? ` / アウト ${preview.outs.join("・")}` : ""}
            </p>
          ) : null}
          {people.map((p) => (
            <div key={p.playerId} className="flex items-center gap-1 overflow-x-auto">
              <span className="text-xs w-20 shrink-0 truncate">
                {p.label} {p.name}
              </span>
              {([1, 2, 3, 4, "out"] as Dest[]).map((d) => (
                <button
                  key={String(d)}
                  type="button"
                  className={`tap min-h-11 px-2 text-xs ${destOf(confirm.moves, p.playerId, p.from) === d ? "tap-accent" : ""}`}
                  onClick={() => setMove(p.playerId, p.from, d)}
                >
                  {d === 4 ? "本" : d === "out" ? "アウト" : `${d}塁`}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="tap flex-1" onClick={() => setConfirm(null)}>
              やり直す
            </button>
            <button
              type="button"
              className="tap tap-accent flex-1"
              onClick={() => {
                const { result, moves, field } = confirm;
                setConfirm(null);
                void patch((g) => commitPlay(g, result, moves, field));
              }}
            >
              {PLAY_LABELS[confirm.result]}で確定
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-2 grid grid-cols-4 gap-1 pb-1">
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("steal")} label="盗塁" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("cs")} label="盗塁死" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("pickoff")} label="牽制" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("pr")} label="代走" />
          </div>
          <div className="px-2 grid grid-cols-2 gap-1 pb-2">
            <Action disabled={occupiedCount === 0} onClick={() => void patch(commitWp)} label="暴投" help={() => { setGlossaryId("wp"); setSheet("glossary"); }} />
            <Action disabled={occupiedCount === 0} onClick={() => void patch(commitPb)} label="捕逸" help={() => { setGlossaryId("pb"); setSheet("glossary"); }} />
          </div>
          {sheet === "steal" || sheet === "cs" || sheet === "pickoff" ? (
            <p className="px-3 pb-2 text-sm text-[#f5c518]">
              {sheet === "steal"
                ? "進塁させる走者をタップ"
                : sheet === "pickoff"
                  ? "牽制アウトにする走者をタップ"
                  : "アウトにする走者をタップ"}
              <button type="button" className="ml-2 underline" onClick={() => setSheet(null)}>
                キャンセル
              </button>
            </p>
          ) : null}

          <div className={`px-2 pb-2 ${leftHanded ? "flex flex-col-reverse" : ""}`}>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button type="button" className="tap" onClick={() => void patch((g) => commitPitch(g, "ball"))}>
                ボール
              </button>
              <button type="button" className="tap" onClick={() => void patch((g) => commitPitch(g, "strike"))}>
                ストライク
              </button>
              <button type="button" className="tap" onClick={() => void patch((g) => commitPitch(g, "foul"))}>
                ファウル
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              <button type="button" className="tap tap-result tap-accent" onClick={() => setSheet("hit")}>
                ヒット
              </button>
              <button type="button" className="tap tap-result" onClick={() => setSheet("out")}>
                アウト
              </button>
              <button type="button" className="tap tap-result" onClick={() => startResult("strikeout")}>
                三振
              </button>
              <button type="button" className="tap tap-result" onClick={() => startResult("dropped_third")}>
                振り逃げ
              </button>
              <button type="button" className="tap tap-result" onClick={() => startResult("walk")}>
                四球
              </button>
              <button type="button" className="tap tap-result" onClick={() => startResult("hbp")}>
                死球
              </button>
              <button type="button" className="tap tap-result" onClick={() => startResult("error")}>
                エラー
              </button>
              <button type="button" className="tap tap-result" onClick={() => setSheet("other")}>
                その他
              </button>
            </div>
          </div>

          <div className="px-2 pb-4 flex gap-2">
            <button
              type="button"
              className="tap flex-1"
              disabled={game.events.length === 0}
              onClick={() => void patch((g) => ({ ...g, events: undoLast(g.events), status: "in_progress" }))}
            >
              ↩ 1つ戻す
            </button>
            <button
              type="button"
              className="tap flex-1"
              disabled={game.events.length === 0}
              onClick={() => void patch((g) => ({ ...g, events: undoAtBat(g.events), status: "in_progress" }))}
            >
              ↩ 打席を戻す
            </button>
          </div>
        </>
      )}

      {sheet === "hit" ? (
        <ResultSheet title="どんなヒット？" results={HIT_RESULTS} onPick={startResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "out" ? (
        <ResultSheet title="どんなアウト？" results={OUT_RESULTS} onPick={startResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "other" ? (
        <Sheet title="その他" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2">
            {OTHER_RESULTS.map((r) => (
              <button key={r} type="button" className="tap tap-result" onClick={() => startResult(r)}>
                {PLAY_LABELS[r]}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet === "field" && pendingResult ? (
        <PositionPicker
          title={`${PLAY_LABELS[pendingResult]} — どこへ？`}
          onClose={() => {
            setSheet(null);
            setPendingResult(null);
          }}
          onPick={(pos) => {
            const result = pendingResult;
            setPendingResult(null);
            setSheet(null);
            finishResult(result, pos);
          }}
        />
      ) : null}
      {sheet === "glossary" ? (
        <GlossarySheet termId={glossaryId} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "menu" ? (
        <Sheet title="試合メニュー" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3">
            <InningScoreTable state={state} firstName={firstName} secondName={secondName} />
            <button type="button" className="tap w-full" onClick={() => setSheet("sub")}>
              選手交代・守備変更
            </button>
            <Link href={`/games/${gameId}/lineup`} className="tap w-full flex items-center justify-center">
              メンバーを修正
            </Link>
            <button
              type="button"
              className="tap tap-accent w-full"
              onClick={() => {
                void patch(commitEnd).then(() => router.push(`/games/${gameId}/summary`));
              }}
            >
              試合を終了する
            </button>
          </div>
        </Sheet>
      ) : null}
      {sheet === "sub" ? (
        <SubSheet
          game={game}
          lineup={getLineup(state, game.mySide)}
          otherLineup={getLineup(state, game.mySide === "first" ? "second" : "first")}
          mySide={game.mySide}
          players={players ?? []}
          onClose={() => setSheet(null)}
          onSub={(s, order, playerId, playerName, position) => {
            void patch((g) => commitSub(g, s, order, playerId, playerName, position));
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "pr" ? (
        <PinchSheet
          battingLineup={getLineup(state, battingSide(state.half))}
          myTeamBatting={battingSide(state.half) === game.mySide}
          stateBases={state.bases}
          players={players ?? []}
          onClose={() => setSheet(null)}
          onPick={(base, player, position) => {
            void patch((g) => commitPinchRunner(g, base, player.id, player.name, position));
            setSheet(null);
          }}
        />
      ) : null}

      {state.regulationComplete && !state.ended ? (
        <p className="px-3 pb-4 text-center text-sm text-[#f5c518]">
          規定回が終わりました。延長は12回まで記録できます。
        </p>
      ) : null}
    </main>
  );
}

function destOf(moves: RunnerMove[], playerId: string, from: 0 | 1 | 2 | 3): Dest | undefined {
  return moves.find((m) => m.playerId === playerId)?.to ?? (from === 0 ? undefined : from);
}

function confirmPeople(
  state: { bases: Array<RunnerOnBase | null> },
  batterId: string,
  batterName: string,
  moves: RunnerMove[],
) {
  const list: Array<{ playerId: string; name: string; from: 0 | 1 | 2 | 3; label: string }> = [
    { playerId: batterId, name: batterName, from: 0, label: "打者" },
  ];
  state.bases.forEach((runner, i) => {
    if (runner) list.push({ playerId: runner.playerId, name: runner.playerName, from: (i + 1) as Base, label: `${i + 1}塁` });
  });
  void moves;
  return list;
}

function Action({
  label,
  onClick,
  disabled,
  help,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  help?: () => void;
}) {
  return (
    <div className="relative flex-1">
      <button type="button" className="tap w-full text-xs" disabled={disabled} onClick={onClick}>
        {label}
      </button>
      {help ? (
        <button
          type="button"
          className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#070a08] border border-[#2c3c30] text-xs"
          onClick={help}
        >
          ?
        </button>
      ) : null}
    </div>
  );
}

function ResultSheet({
  title,
  results,
  onPick,
  onClose,
}: {
  title: string;
  results: PlayResult[];
  onPick: (r: PlayResult) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {results.map((r) => (
          <button key={r} type="button" className="tap tap-result" onClick={() => onPick(r)}>
            {PLAY_LABELS[r]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function SubSheet({
  lineup,
  otherLineup,
  mySide,
  players,
  onClose,
  onSub,
}: {
  game: Game;
  lineup: Game["firstLineup"];
  otherLineup: Game["firstLineup"];
  mySide: Side;
  players: { id: string; name: string }[];
  onClose: () => void;
  onSub: (
    side: Side,
    order: number,
    playerId: string,
    playerName: string,
    position: Game["firstLineup"][0]["position"],
  ) => void;
}) {
  const [order, setOrder] = useState(1);
  const [side, setSide] = useState<Side>(mySide);
  const slots = side === mySide ? lineup : otherLineup;
  const slot = slots.find((s) => s.order === order) ?? slots[0];
  const activeIds = new Set(slots.map((s) => s.playerId));
  const bench = side === mySide ? players.filter((p) => !activeIds.has(p.id)) : [];

  return (
    <Sheet title="選手交代・守備変更" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button type="button" className={`tap ${side === mySide ? "tap-accent" : ""}`} onClick={() => setSide(mySide)}>
          自チーム
        </button>
        <button
          type="button"
          className={`tap ${side !== mySide ? "tap-accent" : ""}`}
          onClick={() => setSide(mySide === "first" ? "second" : "first")}
        >
          相手
        </button>
      </div>
      <p className="text-sm text-[#9aa894] mb-2">打順を選んで、控えと入れ替え / 守備位置を変更</p>
      <div className="grid grid-cols-9 gap-1 mb-3">
        {slots.map((s) => (
          <button
            key={s.order}
            type="button"
            className={`tap min-h-12 px-0 text-sm ${s.order === order ? "tap-accent" : ""}`}
            onClick={() => setOrder(s.order)}
          >
            {s.order}
          </button>
        ))}
      </div>
      <p className="text-sm mb-2">
        {slot.order}番 {slot.playerName}（{POSITION_LABELS[slot.position]}）
      </p>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {(Object.keys(POSITION_LABELS) as Array<keyof typeof POSITION_LABELS>).map((pos) => (
          <button
            key={pos}
            type="button"
            className={`tap min-h-12 text-xs ${slot.position === pos ? "tap-accent" : ""}`}
            onClick={() => onSub(side, slot.order, slot.playerId, slot.playerName, pos)}
          >
            {POSITION_LABELS[pos]}
          </button>
        ))}
      </div>
      {bench.length === 0 ? (
        <p className="text-sm text-[#9aa894]">
          {side === mySide ? "控えがいません。打順画面からも交代できます。" : "相手は打順画面で名前を直せます。"}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {bench.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tap w-full"
              onClick={() => onSub(side, slot.order, p.id, p.name, slot.position)}
            >
              {p.name} と交代
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

function PinchSheet({
  battingLineup,
  myTeamBatting,
  stateBases,
  players,
  onClose,
  onPick,
}: {
  battingLineup: Game["firstLineup"];
  myTeamBatting: boolean;
  stateBases: Array<RunnerOnBase | null>;
  players: { id: string; name: string }[];
  onClose: () => void;
  onPick: (base: Base, player: { id: string; name: string }, position: Game["firstLineup"][0]["position"]) => void;
}) {
  const firstOccupied = ([1, 2, 3] as Base[]).find((b) => stateBases[b - 1]) ?? 1;
  const [base, setBase] = useState<Base>(firstOccupied);
  const [name, setName] = useState("");
  const runner = stateBases[base - 1];
  const slot = battingLineup.find((s) => s.order === runner?.battingOrder);
  const activeIds = new Set(battingLineup.map((s) => s.playerId));
  const bench = myTeamBatting ? players.filter((p) => !activeIds.has(p.id)) : [];
  const position = slot?.position ?? "LF";

  return (
    <Sheet title="代走" onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-2">走者がいる塁を選んで代走を出します（一塁も可）</p>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {([1, 2, 3] as Base[]).map((b) => (
          <button
            key={b}
            type="button"
            className={`tap min-h-16 ${base === b ? "tap-accent" : ""}`}
            disabled={!stateBases[b - 1]}
            onClick={() => setBase(b)}
          >
            {b}塁
            <span className="block text-xs font-normal">{stateBases[b - 1]?.playerName ?? "なし"}</span>
          </button>
        ))}
      </div>
      {runner ? (
        <p className="text-sm mb-2 font-bold">
          {base}塁の {runner.playerName} →
        </p>
      ) : (
        <p className="text-sm">その塁に走者がいません</p>
      )}
      {bench.map((p) => (
        <button
          key={p.id}
          type="button"
          className="tap w-full mb-2"
          disabled={!runner}
          onClick={() => onPick(base, p, position)}
        >
          {p.name} を代走に
        </button>
      ))}
      <div className="flex gap-2 mt-2">
        <input
          className="tap flex-1 px-3 bg-[#121a14]"
          lang="ja"
          placeholder="名前を入力して代走"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="tap tap-accent px-4"
          disabled={!runner || !name.trim()}
          onClick={() =>
            onPick(base, { id: `pr-${Date.now()}`, name: name.trim() }, position)
          }
        >
          出す
        </button>
      </div>
    </Sheet>
  );
}
