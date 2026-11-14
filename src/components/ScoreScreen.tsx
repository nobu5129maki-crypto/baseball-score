"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  commitEnd,
  commitPb,
  commitPickoff,
  commitPinchHitter,
  commitPinchRunner,
  commitPitch,
  commitPlay,
  commitSteal,
  commitWp,
  commitBench,
  commitBk,
  battingSide,
  fieldingSide,
  getBatter,
  getLineup,
  getPitcher,
  needsFieldPosition,
  needsRunnerConfirm,
  needsStrikeThreeChoice,
  canDroppedThird,
  playBlockedReason,
  nextStealBaseOpen,
  previewAfterMoves,
  proposeBench,
  proposeDeadBall,
  proposeMoves,
  proposeOffensiveInterference,
  reduceGame,
  totalRuns,
  undoAtBat,
  undoLast,
} from "@/lib/engine";
import { db, loadPlayersOnTeam, saveGame } from "@/lib/db";
import { createSaveQueue } from "@/lib/save-queue";
import { applyGameTimes, normalizeTime } from "@/lib/game-time";
import { HIT_RESULTS, OUT_RESULTS, PLAY_LABELS, BATTED_BALLS, BATTED_HINTS, BATTED_LABELS, isHitResult, jerseyLabel } from "@/lib/labels";
import { playerProfileLabel } from "@/lib/player-profile";
import { DROPPED_THIRD, benchAdvanceNote, deadBallAdvanceNote, interferenceAdvanceNote } from "@/lib/rules";
import { runChangeMessage, runChangeRuleLabel } from "@/lib/run-change";
import { atBatsThisGame, batterAtBatLine, batterLine, careerGames, slashAcrossGames, slashFor } from "@/lib/stats";
import { opponentBenchPlayers, rememberOpponentBench } from "@/lib/opponent-bench";
import { POSITION_LABELS } from "@/lib/types";
import type { Base, BattedBall, Dest, Game, LineupSlot, PlayResult, Position, RunnerMove, RunnerOnBase } from "@/lib/types";
import { DefenseSheet } from "./DefenseSheet";
import { PlayerIdentity } from "./PlayerIdentity";
import { DiamondMap } from "./DiamondMap";
import { StartTimeConfirmed, StartTimePrompt } from "./GameTimeFields";
import { GlossarySheet } from "./GlossarySheet";
import { InningScoreTable } from "./InningScoreTable";
import { PositionPicker } from "./PositionPicker";
import { Sheet } from "./Sheet";

type SheetKind =
  | null
  | "hit"
  | "out"
  | "menu"
  | "sub"
  | "glossary"
  | "steal"
  | "cs"
  | "pickoff"
  | "pr"
  | "ph"
  | "field"
  | "batted"
  | "wp_hold"
  | "pb_hold"
  | "dead_kind"
  | "dead_batted"
  | "dead_fielded"
  | "dead_error"
  | "offensive_interference"
  | "offensive_runner";

export function ScoreScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const enqueueSave = useRef(createSaveQueue()).current;
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const players = useLiveQuery(async () => {
    const g = await db.games.get(gameId);
    if (!g) return [];
    return loadPlayersOnTeam(g.myTeamId);
  }, [gameId]);
  const allGames = useLiveQuery(() => db.games.toArray(), []);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [glossaryId, setGlossaryId] = useState<string | "index">("index");
  const [glossaryBack, setGlossaryBack] = useState<SheetKind>(null);
  const [pendingResult, setPendingResult] = useState<PlayResult | null>(null);
  const [pendingBatted, setPendingBatted] = useState<BattedBall | undefined>(undefined);
  const [confirm, setConfirm] = useState<{
    result: PlayResult;
    moves: RunnerMove[];
    field?: Position;
    batted?: BattedBall;
    selectedId: string | null;
    deadBall?: boolean;
    fieldedBy?: Position;
  } | null>(null);
  const [deadDraft, setDeadDraft] = useState<{ batted: BattedBall; fieldedBy?: Position } | null>(null);
  const [bench, setBench] = useState<{ moves: RunnerMove[]; selectedId: string | null } | null>(null);
  const [startNotice, setStartNotice] = useState<string | null>(null);
  const dismissStartNotice = useCallback(() => setStartNotice(null), []);
  const state = useMemo(() => (game ? reduceGame(game) : null), [game]);
  const noticeRuns = state?.runChangeNotice;
  useEffect(() => {
    if (noticeRuns == null) return;
    document.getElementById("run-change-notice")?.scrollIntoView({ block: "center" });
  }, [noticeRuns, game?.events.length]);

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
  const chooseK = needsStrikeThreeChoice(state);
  const allowDroppedThird = canDroppedThird(state);
  const gidpBlocked = playBlockedReason("gidp", state);
  const fcBlocked = playBlockedReason("fielders_choice", state);
  const sacBuntBlocked = playBlockedReason("sac_bunt", state);
  const sacFlyBlocked = playBlockedReason("sac_fly", state);
  const outResults = OUT_RESULTS.filter((r) => !playBlockedReason(r, state));
  const gameSlash = slashFor(game, batter.playerId);
  const slash =
    slashAcrossGames(careerGames(allGames ?? [game], game.myTeamId, game), batter.playerId) ??
    gameSlash;
  const atBats = atBatsThisGame(game, batter, state.half);
  const batterProfile = playerProfileLabel(players?.find((p) => p.id === batter.playerId) ?? batter);
  const people = confirmPeople(state, batter.playerId, batter.playerName, confirm?.moves ?? []);
  const preview = confirm
    ? previewAfterMoves(state, confirm.moves, batter)
    : bench
      ? previewAfterMoves(state, bench.moves, batter)
      : null;
  const benchPeople = state.bases.flatMap((runner, index) =>
    runner
      ? [
          {
            playerId: runner.playerId,
            name: runner.playerName,
            from: (index + 1) as Base,
            label: `${index + 1}塁`,
          },
        ]
      : [],
  );

  function patch(mut: (g: Game) => Game) {
    return enqueueSave(async () => {
      const latest = await db.games.get(gameId);
      if (!latest) return;
      await saveGame(mut(latest));
    });
  }

  function askWildPitch(kind: "wp" | "pb") {
    if (!state) return;
    if (state.bases[0] && state.bases[2]) {
      setSheet(kind === "wp" ? "wp_hold" : "pb_hold");
      return;
    }
    void patch((g) => (kind === "wp" ? commitWp(g) : commitPb(g)));
  }

  function startResult(result: PlayResult) {
    setSheet(null);
    if (!state) return;
    if (playBlockedReason(result, state)) return;
    if (isHitResult(result)) {
      setPendingResult(result);
      setPendingBatted(undefined);
      setSheet("batted");
      return;
    }
    if (needsFieldPosition(result)) {
      setPendingResult(result);
      setPendingBatted(undefined);
      setSheet("field");
      return;
    }
    finishResult(result);
  }

  function finishResult(result: PlayResult, field?: Position, batted?: BattedBall) {
    if (!state) return;
    const moves = proposeMoves(result, state, batter);
    if (needsRunnerConfirm(result, state)) {
      setConfirm({ result, moves, field, batted, selectedId: null });
      return;
    }
    void patch((g) => commitPlay(g, result, moves, field, batted));
  }

  function startDeadBall() {
    setConfirm(null);
    setBench(null);
    setDeadDraft(null);
    setSheet("dead_kind");
  }

  function startBenchDead() {
    if (!state || !state.bases.some(Boolean)) return;
    setSheet(null);
    setConfirm(null);
    setBench({ moves: proposeBench(state), selectedId: null });
  }

  function finishDeadBall(errorBy: Position, fieldedBy: Position, batted: BattedBall) {
    if (!state) return;
    const moves = proposeDeadBall(state, batter);
    setDeadDraft(null);
    setSheet(null);
    if (needsRunnerConfirm("error", state)) {
      setConfirm({
        result: "error",
        moves,
        field: errorBy,
        batted,
        fieldedBy,
        deadBall: true,
        selectedId: null,
      });
      return;
    }
    void patch((g) =>
      commitPlay(g, "error", moves, errorBy, batted, { deadBall: true, fieldedBy }),
    );
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
      if (!state || !nextStealBaseOpen(state, from)) return;
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
    if (bench) {
      setBench({ ...bench, selectedId: runner.playerId });
      return;
    }
    if (!confirm) return;
    setConfirm({ ...confirm, selectedId: runner.playerId });
  }

  function onSelectDest(to: Dest) {
    if (!state) return;
    if (bench?.selectedId) {
      const selected = bench.selectedId;
      const from =
        bench.moves.find((m) => m.playerId === selected)?.from ??
        ((state.bases.findIndex((b) => b?.playerId === selected) + 1 || 0) as 0 | 1 | 2 | 3);
      const rest = bench.moves.filter((m) => m.playerId !== selected);
      setBench({
        moves: [...rest, { playerId: selected, from, to }],
        selectedId: null,
      });
      return;
    }
    if (!confirm) return;
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
          <p className="text-sm font-bold">
            <span className={state.half === "top" ? "text-[#f5c518]" : "text-[#9aa894]"}>
              {state.half === "top" ? "攻 " : ""}
              {firstName}
            </span>
            <span className="text-[#9aa894]"> vs </span>
            <span className={state.half === "bottom" ? "text-[#f5c518]" : "text-[#9aa894]"}>
              {secondName}
              {state.half === "bottom" ? " 攻" : ""}
            </span>
          </p>
        </div>
        <button type="button" className="tap tap-ghost px-3 text-sm" onClick={() => setSheet("menu")}>
          ⋯
        </button>
      </header>

      {state.runChangeNotice != null ? (
        <p
          id="run-change-notice"
          role="status"
          className="sticky top-0 z-40 mx-3 mt-2 rounded-2xl bg-[#f5c518] px-4 py-4 text-center text-xl font-bold leading-snug text-[#14180c] shadow-lg"
        >
          {runChangeMessage(state.runChangeNotice)}
        </p>
      ) : null}

      {startNotice ? (
        <StartTimeConfirmed
          time={startNotice}
          onDismiss={dismissStartNotice}
          onEdit={() => {
            setStartNotice(null);
            void patch((g) => {
              const next = { ...g };
              delete next.startTime;
              return next;
            });
          }}
        />
      ) : game.status === "in_progress" && !normalizeTime(game.startTime) ? (
        <StartTimePrompt
          onSave={(time) => {
            setStartNotice(time);
            void patch((g) => applyGameTimes(g, { startTime: time, endTime: g.endTime }));
          }}
        />
      ) : null}

      <div className="mx-3 my-2 rounded-2xl border-2 border-[#f5c518] bg-[#1a281c] px-3 py-3">
        <p className="text-[11px] text-[#f5c518] font-bold tracking-wide">
          {state.half === "top" ? firstName : secondName} の攻撃
        </p>
        <p className="leading-tight mt-0.5 break-words">
          <PlayerIdentity order={batter.order} name={batter.playerName} number={batter.number} size="lg" />
        </p>
        <p className="text-sm text-[#d5dccf]">{POSITION_LABELS[batter.position]}</p>
        {batterProfile ? <p className="text-sm text-[#9aa894]">{batterProfile}</p> : null}
        <p className="text-sm font-bold mt-1">
          {batterAtBatLine(slash ?? { ab: 0, h: 0, hr: 0, rbi: 0 })}
        </p>
        {atBats.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {atBats.map((ab, i) => (
              <span
                key={`${ab.inning}-${ab.result}-${i}`}
                className={`rounded-lg bg-[#070a08] border border-[#2c3c30] px-2 py-1 text-sm font-bold ${
                  isHitResult(ab.result) ? "text-[#ff5a5a]" : ""
                }`}
              >
                {ab.inning}回 {ab.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[#9aa894] mt-1">今試合 まだ打席なし</p>
        )}
        {gameSlash && atBats.length > 0 ? (
          <p className="text-xs text-[#9aa894] mt-1">今試合 {batterLine(gameSlash)}</p>
        ) : null}
      </div>

      <DiamondMap
        state={state}
        firstName={firstName}
        secondName={secondName}
        ruleLabel={runChangeRuleLabel(game.runChangeAt) ?? undefined}
        selectedId={confirm?.selectedId ?? bench?.selectedId ?? null}
        edit={Boolean(confirm || bench)}
        showOutButton={Boolean(confirm || bench)}
        pitcherName={pitcher?.playerName}
        onSelectRunner={onSelectRunner}
        onSelectDest={onSelectDest}
      />

      {state.ended && !confirm && !bench ? (
        <div className="px-3 pb-4 flex flex-col gap-3">
          <p className="text-center font-bold text-[#f5c518] leading-relaxed">
            {state.bottomUnplayed
              ? "後攻がリードしていたため、この回の裏は行いません。試合終了です。"
              : state.half === "bottom" && totalRuns(state.scores.second) > totalRuns(state.scores.first)
                ? "サヨナラで試合終了です。"
                : "試合終了です。"}
          </p>
          <button
            type="button"
            className="tap tap-accent w-full"
            onClick={() => {
              void patch(commitEnd).then(() => router.push(`/games/${gameId}/summary`));
            }}
          >
            詳細を見る
          </button>
          <div className="flex gap-2">
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
        </div>
      ) : confirm ? (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-sm text-[#f5c518]">
            {confirm.deadBall
              ? deadBallAdvanceNote(state.bases)
              : (interferenceAdvanceNote(confirm.result) ??
                "進塁先を直してから確定（走者をタップ→塁をタップ）")}
          </p>
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
                const { result, moves, field, batted, deadBall, fieldedBy } = confirm;
                setConfirm(null);
                void patch((g) =>
                  commitPlay(
                    g,
                    result,
                    moves,
                    field,
                    batted,
                    deadBall || fieldedBy ? { deadBall, fieldedBy } : undefined,
                  ),
                );
              }}
            >
              {confirm.deadBall ? "ボールデッド" : PLAY_LABELS[confirm.result]}
              {!confirm.deadBall && confirm.batted ? `（${BATTED_LABELS[confirm.batted]}）` : ""}
              で確定
            </button>
          </div>
        </div>
      ) : bench ? (
        <div className="px-3 pb-3 flex flex-col gap-2">
          <p className="text-sm text-[#f5c518]">{benchAdvanceNote(state.bases)}</p>
          {preview ? (
            <p className="text-xs text-[#d5dccf]">
              確定後: 1塁 {preview.bases[0]?.playerName ?? "なし"} / 2塁 {preview.bases[1]?.playerName ?? "なし"} / 3塁{" "}
              {preview.bases[2]?.playerName ?? "なし"}
              {preview.scored.length ? ` / 生還 ${preview.scored.join("・")}` : ""}
            </p>
          ) : null}
          {benchPeople.map((p) => (
            <div key={p.playerId} className="flex items-center gap-1 overflow-x-auto">
              <span className="text-xs w-20 shrink-0 truncate">
                {p.label} {p.name}
              </span>
              {([1, 2, 3, 4, "out"] as Dest[]).map((d) => (
                <button
                  key={String(d)}
                  type="button"
                  className={`tap min-h-11 px-2 text-xs ${destOf(bench.moves, p.playerId, p.from) === d ? "tap-accent" : ""}`}
                  onClick={() => {
                    const rest = bench.moves.filter((m) => m.playerId !== p.playerId);
                    setBench({
                      moves: [...rest, { playerId: p.playerId, from: p.from, to: d }],
                      selectedId: null,
                    });
                  }}
                >
                  {d === 4 ? "本" : d === "out" ? "アウト" : `${d}塁`}
                </button>
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="tap flex-1" onClick={() => setBench(null)}>
              やり直す
            </button>
            <button
              type="button"
              className="tap tap-accent flex-1"
              onClick={() => {
                const moves = bench.moves;
                setBench(null);
                void patch((g) => commitBench(g, moves));
              }}
            >
              ボールデッドで確定
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="px-2 pb-1">
            <button type="button" className="tap w-full text-sm" onClick={() => setSheet("sub")}>
              守備位置・交代
            </button>
            {fieldingSide(state.half) === game.mySide ? (
              <p className="text-xs text-[#f5c518] text-center mt-1">今は守備中。投手交代や守備位置の入れ替えはここから</p>
            ) : null}
          </div>
          <div className="px-2 grid grid-cols-5 gap-1 pb-1">
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("steal")} label="盗塁" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("cs")} label="盗塁死" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("pickoff")} label="牽制" />
            <Action onClick={() => setSheet("ph")} label="代打" />
            <Action disabled={occupiedCount === 0} onClick={() => setSheet("pr")} label="代走" />
          </div>
          <div className="px-2 grid grid-cols-3 gap-1 pb-2">
            <Action
              disabled={occupiedCount === 0}
              onClick={() => askWildPitch("wp")}
              label="暴投"
              help={() => {
                setGlossaryId("wp");
                setGlossaryBack(null);
                setSheet("glossary");
              }}
            />
            <Action
              disabled={occupiedCount === 0}
              onClick={() => askWildPitch("pb")}
              label="捕逸"
              help={() => {
                setGlossaryId("pb");
                setGlossaryBack(null);
                setSheet("glossary");
              }}
            />
            <Action
              disabled={occupiedCount === 0}
              onClick={() => void patch(commitBk)}
              label="ボーク"
              help={() => {
                setGlossaryId("bk");
                setGlossaryBack(null);
                setSheet("glossary");
              }}
            />
          </div>
          <div className="px-2 pb-2">
            {chooseK ? (
              <div className="mb-2">
                <p className="text-sm text-[#f5c518] text-center font-bold mb-2 leading-relaxed">
                  {allowDroppedThird ? DROPPED_THIRD.choosePrompt : DROPPED_THIRD.strikeoutOnlyPrompt}
                </p>
                {!allowDroppedThird ? (
                  <p className="text-xs text-[#9aa894] text-center mb-2 leading-relaxed">
                    {DROPPED_THIRD.blockedHint}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="tap tap-result tap-out min-h-16"
                    onClick={() => startResult("strikeout_looking")}
                  >
                    <span className="block text-xs font-normal opacity-90">見送った</span>
                    見逃し三振
                  </button>
                  <button
                    type="button"
                    className="tap tap-result tap-out min-h-16"
                    onClick={() => startResult("strikeout_swinging")}
                  >
                    <span className="block text-xs font-normal opacity-90">振った</span>
                    空振り三振
                  </button>
                </div>
                {allowDroppedThird ? (
                  <button
                    type="button"
                    className="tap tap-result tap-hit w-full mt-2"
                    onClick={() => startResult("dropped_third")}
                  >
                    振り逃げ
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button type="button" className="tap tap-ball" onClick={() => void patch((g) => commitPitch(g, "ball"))}>
                    ボール
                  </button>
                  <button type="button" className="tap tap-strike" onClick={() => void patch((g) => commitPitch(g, "strike"))}>
                    ストライク
                  </button>
                  <button type="button" className="tap tap-foul" onClick={() => void patch((g) => commitPitch(g, "foul"))}>
                    ファウル
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <button type="button" className="tap tap-result tap-hit" onClick={() => setSheet("hit")}>
                    ヒット
                  </button>
                  <button type="button" className="tap tap-result tap-out" onClick={() => setSheet("out")}>
                    アウト
                  </button>
                  <button type="button" className="tap tap-result" onClick={() => startResult("hbp")}>
                    死球
                  </button>
                  <button type="button" className="tap tap-result" onClick={() => startResult("error")}>
                    エラー
                  </button>
                  {!gidpBlocked ? (
                    <button type="button" className="tap tap-result" onClick={() => startResult("gidp")}>
                      併殺
                    </button>
                  ) : null}
                  {!fcBlocked ? (
                    <HelpResultButton
                      label="野選"
                      helpLabel="野選の解説"
                      onClick={() => startResult("fielders_choice")}
                      onHelp={() => {
                        setGlossaryId("fc");
                        setGlossaryBack(null);
                        setSheet("glossary");
                      }}
                    />
                  ) : null}
                  {!sacBuntBlocked ? (
                    <HelpResultButton
                      label="送りバント"
                      helpLabel="送りバントの解説"
                      onClick={() => startResult("sac_bunt")}
                      onHelp={() => {
                        setGlossaryId("sh");
                        setGlossaryBack(null);
                        setSheet("glossary");
                      }}
                    />
                  ) : null}
                  {!sacFlyBlocked ? (
                    <HelpResultButton
                      label="犠牲フライ"
                      helpLabel="犠牲フライの解説"
                      onClick={() => startResult("sac_fly")}
                      onHelp={() => {
                        setGlossaryId("sf");
                        setGlossaryBack(null);
                        setSheet("glossary");
                      }}
                    />
                  ) : null}
                  <HelpResultButton
                    label="ボールデッド"
                    helpLabel="ボールデッドの解説"
                    onClick={startDeadBall}
                    onHelp={() => {
                      setGlossaryId("dead");
                      setGlossaryBack(null);
                      setSheet("glossary");
                    }}
                  />
                  <HelpResultButton
                    label="打撃妨害"
                    helpLabel="打撃妨害の解説"
                    onClick={() => startResult("catcher_interference")}
                    onHelp={() => {
                      setGlossaryId("ci");
                      setGlossaryBack(null);
                      setSheet("glossary");
                    }}
                  />
                  <HelpResultButton
                    label="守備妨害"
                    helpLabel="守備妨害の解説"
                    onClick={() => {
                      if (occupiedCount === 0) {
                        startResult("offensive_interference");
                        return;
                      }
                      setSheet("offensive_interference");
                    }}
                    onHelp={() => {
                      setGlossaryId("oi");
                      setGlossaryBack(null);
                      setSheet("glossary");
                    }}
                  />
                </div>
              </>
            )}
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
      {sheet === "batted" && pendingResult ? (
        <Sheet
          title={`${PLAY_LABELS[pendingResult]}はどんな当たり？`}
          onClose={() => {
            setSheet(null);
            setPendingResult(null);
            setPendingBatted(undefined);
          }}
        >
          <div className="grid grid-cols-3 gap-2">
            {BATTED_BALLS.map((kind) => (
              <button
                key={kind}
                type="button"
                className={`tap tap-result min-h-20 ${pendingBatted === kind ? "tap-accent" : ""}`}
                onClick={() => {
                  const result = pendingResult;
                  setPendingBatted(kind);
                  if (needsFieldPosition(result)) {
                    setSheet("field");
                    return;
                  }
                  setPendingResult(null);
                  setPendingBatted(undefined);
                  setSheet(null);
                  finishResult(result, undefined, kind);
                }}
              >
                <span className="block text-xs font-normal opacity-90">{BATTED_HINTS[kind]}</span>
                {BATTED_LABELS[kind]}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet === "out" ? (
        <ResultSheet title="どんなアウト？" results={outResults} onPick={startResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "dead_kind" ? (
        <Sheet
          title="ボールデッド"
          onClose={() => {
            setSheet(null);
            setDeadDraft(null);
          }}
        >
          <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
            ボールがベンチやスタンドに入って、プレーが止まりました。
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="tap tap-result min-h-20"
              onClick={() => setSheet("dead_batted")}
            >
              <span className="block text-xs font-normal opacity-90">打者は1塁。いる走者はそれぞれ1つ進む</span>
              打球のあと、後逸して入った
            </button>
            <button
              type="button"
              className="tap tap-result min-h-20"
              disabled={occupiedCount === 0}
              onClick={startBenchDead}
            >
              <span className="block text-xs font-normal opacity-90">
                {occupiedCount === 0
                  ? "走者がいないと選べません"
                  : "いる走者はそれぞれ1つ進む。打者はそのまま"}
              </span>
              送球がベンチに入った
            </button>
          </div>
        </Sheet>
      ) : null}
      {sheet === "dead_batted" ? (
        <Sheet
          title="ボールデッド — どんな当たり？"
          onClose={() => {
            setDeadDraft(null);
            setSheet("dead_kind");
          }}
        >
          <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
            ベンチやスタンドに入ってプレーが止まった打球です。ショートゴロなら「ゴロ」を選んでください。
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BATTED_BALLS.map((kind) => (
              <button
                key={kind}
                type="button"
                className="tap tap-result min-h-20"
                onClick={() => {
                  setDeadDraft({ batted: kind });
                  setSheet("dead_fielded");
                }}
              >
                <span className="block text-xs font-normal opacity-90">{BATTED_HINTS[kind]}</span>
                {BATTED_LABELS[kind]}
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {sheet === "dead_fielded" && deadDraft ? (
        <PositionPicker
          title="打球はどこへ？"
          hint="打球が飛んだ場所です。ショートゴロならショートを選んでください。"
          onClose={() => setSheet("dead_batted")}
          onPick={(pos) => {
            setDeadDraft({ ...deadDraft, fieldedBy: pos });
            setSheet("dead_error");
          }}
        />
      ) : null}
      {sheet === "dead_error" && deadDraft?.fieldedBy ? (
        <PositionPicker
          title="後逸したのはだれ？"
          hint="ボールを後ろにそらして、ベンチやスタンドに入れてしまった野手です。ショートゴロをファーストが後逸したときは、ファーストを選んでください。"
          onClose={() => setSheet("dead_fielded")}
          onPick={(pos) => {
            const { batted, fieldedBy } = deadDraft;
            if (!fieldedBy) return;
            finishDeadBall(pos, fieldedBy, batted);
          }}
        />
      ) : null}
      {sheet === "field" && pendingResult ? (
        <PositionPicker
          title={`${PLAY_LABELS[pendingResult]}${pendingBatted ? `（${BATTED_LABELS[pendingBatted]}）` : ""} — どこへ？`}
          onClose={() => {
            if (isHitResult(pendingResult)) {
              setSheet("batted");
              return;
            }
            setSheet(null);
            setPendingResult(null);
            setPendingBatted(undefined);
          }}
          onPick={(pos) => {
            const result = pendingResult;
            const batted = pendingBatted;
            setPendingResult(null);
            setPendingBatted(undefined);
            setSheet(null);
            finishResult(result, pos, batted);
          }}
        />
      ) : null}
      {sheet === "glossary" ? (
        <GlossarySheet
          termId={glossaryId}
          onClose={() => {
            setSheet(glossaryBack);
            setGlossaryBack(null);
          }}
        />
      ) : null}
      {sheet === "menu" ? (
        <Sheet title="試合メニュー" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3">
            <InningScoreTable game={game} state={state} firstName={firstName} secondName={secondName} />
            <button type="button" className="tap w-full" onClick={() => setSheet("sub")}>
              守備位置・交代
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
        <DefenseSheet
          lineup={getLineup(state, game.mySide)}
          otherLineup={getLineup(state, game.mySide === "first" ? "second" : "first")}
          mySide={game.mySide}
          fieldingSide={fieldingSide(state.half)}
          myTeamName={game.myTeamName}
          opponentName={game.opponentName}
          players={players ?? []}
          otherPlayers={opponentBenchPlayers(game)}
          useDh={Boolean(game.useDh)}
          myPitcher={game.mySide === "first" ? state.firstPitcher : state.secondPitcher}
          otherPitcher={game.mySide === "first" ? state.secondPitcher : state.firstPitcher}
          onApply={(mut) => void patch(mut)}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "wp_hold" || sheet === "pb_hold" ? (
        <WildAdvanceSheet
          kind={sheet === "wp_hold" ? "wp" : "pb"}
          bases={state.bases}
          onChoose={(holdFirst) => {
            const kind = sheet === "wp_hold" ? "wp" : "pb";
            void patch((g) => (kind === "wp" ? commitWp(g, { holdFirst }) : commitPb(g, { holdFirst })));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "steal" ? (
        <RunnerPickSheet
          title="盗塁"
          hint="進塁させる走者を1人選んでください。次の塁に走者がいるときは盗塁できません。先にその走者を動かしてください。"
          bases={state.bases}
          action={(b, name) => `${b}塁の${name} を ${b === 3 ? "本塁" : `${b + 1}塁`}へ`}
          canPick={(b) => nextStealBaseOpen(state, b)}
          onPick={(from) => {
            const to: Dest = from === 3 ? 4 : ((from + 1) as Dest);
            void patch((g) => commitSteal(g, from, to));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "cs" ? (
        <RunnerPickSheet
          title="盗塁死"
          hint="アウトになった走者を1人選んでください。"
          bases={state.bases}
          action={(b, name) => `${b}塁の${name} を盗塁死（アウト）`}
          danger
          onPick={(from) => {
            void patch((g) => commitSteal(g, from, "out"));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "pickoff" ? (
        <RunnerPickSheet
          title="牽制アウト"
          hint="アウトになった走者を1人選んでください。牽制ボタンをもう一度押したり、「アウトにする」を押す必要はありません。"
          bases={state.bases}
          action={(b, name) => `${b}塁の${name} を牽制アウト`}
          danger
          onPick={(from) => {
            void patch((g) => commitPickoff(g, from));
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
      {sheet === "offensive_interference" ? (
        <Sheet title="守備妨害" onClose={() => setSheet(null)}>
          <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
            誰が邪魔しましたか。フェアの打球が走者に当たったときも、当たった走者を選んでください。ボールはデッドです。安打にはしません。
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="tap tap-result min-h-20"
              onClick={() => startResult("offensive_interference")}
            >
              <span className="block text-xs font-normal opacity-90">打者アウト。走者は塁に残る</span>
              打者が邪魔した
            </button>
            <button
              type="button"
              className="tap tap-result min-h-20"
              disabled={occupiedCount === 0}
              onClick={() => setSheet("offensive_runner")}
            >
              <span className="block text-xs font-normal opacity-90">
                その走者がアウト。走者当たりもここ。2アウト未満なら打者は1塁
              </span>
              走者が邪魔した
            </button>
          </div>
        </Sheet>
      ) : null}
      {sheet === "offensive_runner" ? (
        <RunnerPickSheet
          title="守備妨害"
          hint="邪魔した走者、または打球が当たった走者を1人選んでください。その走者はアウトです。2アウト未満なら打者は1塁に出ます。すでに2アウトなら、その走者で3アウトになり打者は出塁しません。安打にはしません。"
          bases={state.bases}
          action={(b, name) => `${b}塁の${name} が邪魔した（アウト）`}
          danger
          onPick={(from) => {
            const moves = proposeOffensiveInterference(state, batter, from);
            setConfirm({ result: "offensive_interference", moves, selectedId: null });
            setSheet(null);
          }}
          onClose={() => setSheet("offensive_interference")}
        />
      ) : null}
      {sheet === "pr" ? (
        <PinchSheet
          battingLineup={getLineup(state, battingSide(state.half))}
          myTeamBatting={battingSide(state.half) === game.mySide}
          stateBases={state.bases}
          players={
            battingSide(state.half) === game.mySide ? (players ?? []) : opponentBenchPlayers(game)
          }
          onClose={() => setSheet(null)}
          onPick={(base, player, position) => {
            const runner = state.bases[base - 1];
            void patch((g) => {
              let next = commitPinchRunner(g, base, player.id, player.name, position, player.number);
              if (battingSide(state.half) !== game.mySide && runner) {
                const slot = getLineup(state, battingSide(state.half)).find(
                  (s) => s.order === runner.battingOrder,
                );
                next = rememberOpponentBench(next, {
                  playerId: runner.playerId,
                  playerName: runner.playerName,
                  number: slot?.number,
                });
              }
              return next;
            });
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "ph" ? (
        <PinchHitterSheet
          batter={batter}
          battingLineup={getLineup(state, battingSide(state.half))}
          myTeamBatting={battingSide(state.half) === game.mySide}
          players={
            battingSide(state.half) === game.mySide ? (players ?? []) : opponentBenchPlayers(game)
          }
          onClose={() => setSheet(null)}
          onPick={(player) => {
            void patch((g) => {
              let next = commitPinchHitter(g, player.id, player.name, player.number);
              if (battingSide(state.half) !== game.mySide) {
                next = rememberOpponentBench(next, {
                  playerId: batter.playerId,
                  playerName: batter.playerName,
                  number: batter.number,
                });
              }
              return next;
            });
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

function HelpResultButton({
  label,
  hint,
  helpLabel,
  onClick,
  onHelp,
}: {
  label: string;
  hint?: string;
  helpLabel: string;
  onClick: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="relative w-full">
      <button
        type="button"
        className={`tap tap-result w-full px-1 leading-tight ${hint ? "min-h-20" : ""}`}
        onClick={onClick}
      >
        {hint ? <span className="block text-xs font-normal opacity-90">{hint}</span> : null}
        {label}
      </button>
      <button
        type="button"
        className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#070a08] border border-[#2c3c30] text-xs font-bold"
        aria-label={helpLabel}
        onClick={onHelp}
      >
        ?
      </button>
    </div>
  );
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

function RunnerPickSheet({
  title,
  hint,
  bases,
  action,
  danger,
  canPick,
  onPick,
  onClose,
}: {
  title: string;
  hint: string;
  bases: Array<RunnerOnBase | null>;
  action: (base: Base, name: string) => string;
  danger?: boolean;
  canPick?: (base: Base) => boolean;
  onPick: (base: Base) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title={title} onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">{hint}</p>
      <div className="flex flex-col gap-2">
        {([1, 2, 3] as Base[]).map((b) => {
          const runner = bases[b - 1];
          if (!runner) return null;
          if (canPick && !canPick(b)) return null;
          return (
            <button
              key={b}
              type="button"
              className={`tap tap-result w-full ${danger ? "tap-danger" : "tap-accent"}`}
              onClick={() => onPick(b)}
            >
              {action(b, runner.playerName)}
            </button>
          );
        })}
      </div>
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
  players: { id: string; name: string; number?: string }[];
  onClose: () => void;
  onPick: (
    base: Base,
    player: { id: string; name: string; number?: string },
    position: Game["firstLineup"][0]["position"],
  ) => void;
}) {
  const firstOccupied = ([1, 2, 3] as Base[]).find((b) => stateBases[b - 1]) ?? 1;
  const [base, setBase] = useState<Base>(firstOccupied);
  const [name, setName] = useState("");
  const runner = stateBases[base - 1];
  const slot = battingLineup.find((s) => s.order === runner?.battingOrder);
  const activeIds = new Set(battingLineup.map((s) => s.playerId));
  const bench = players.filter((p) => !activeIds.has(p.id));
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
          {p.number ? `${jerseyLabel(p.number)} ` : ""}
          {p.name} を代走に
        </button>
      ))}
      {bench.length === 0 ? (
        <p className="text-sm text-[#9aa894] mb-2">
          {myTeamBatting
            ? "控えがいません。名前を入力しても出せます。"
            : "打順画面で控えを追加するか、下に名前を入力してください。"}
        </p>
      ) : null}
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

function PinchHitterSheet({
  batter,
  battingLineup,
  myTeamBatting,
  players,
  onClose,
  onPick,
}: {
  batter: LineupSlot;
  battingLineup: Game["firstLineup"];
  myTeamBatting: boolean;
  players: { id: string; name: string; number?: string }[];
  onClose: () => void;
  onPick: (player: { id: string; name: string; number?: string }) => void;
}) {
  const [name, setName] = useState("");
  const activeIds = new Set(battingLineup.map((s) => s.playerId));
  const bench = players.filter((p) => !activeIds.has(p.id));

  return (
    <Sheet title="代打" onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
        今の打者 {batter.order}番 {batter.playerName}
        {batter.number ? ` ${jerseyLabel(batter.number)}` : ""} を代打にします。ボール・ストライクはそのままです。守備位置を変えたいときは「守備位置・交代」から直せます。
      </p>
      {bench.map((p) => (
        <button
          key={p.id}
          type="button"
          className="tap tap-result tap-accent w-full mb-2"
          onClick={() => onPick(p)}
        >
          {p.number ? `${jerseyLabel(p.number)} ` : ""}
          {p.name} を代打に
        </button>
      ))}
      {bench.length === 0 ? (
        <p className="text-sm text-[#9aa894] mb-2">
          {myTeamBatting
            ? "控えがいません。名前を入力しても出せます。"
            : "打順画面で控えを追加するか、下に名前を入力してください。"}
        </p>
      ) : null}
      <div className="flex gap-2 mt-2">
        <input
          className="tap flex-1 px-3 bg-[#121a14]"
          lang="ja"
          placeholder="名前を入力して代打"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className="tap tap-accent px-4"
          disabled={!name.trim()}
          onClick={() => onPick({ id: `ph-${Date.now()}`, name: name.trim() })}
        >
          出す
        </button>
      </div>
    </Sheet>
  );
}

function WildAdvanceSheet({
  kind,
  bases,
  onChoose,
  onClose,
}: {
  kind: "wp" | "pb";
  bases: Array<RunnerOnBase | null>;
  onChoose: (holdFirst: boolean) => void;
  onClose: () => void;
}) {
  const first = bases[0];
  const second = bases[1];
  const third = bases[2];
  return (
    <Sheet title={kind === "wp" ? "暴投" : "捕逸"} onClose={onClose}>
      <p className="text-sm leading-relaxed mb-4">
        三塁の{third?.playerName ?? "走者"}はホームへ進みます。
        {second ? `二塁の${second.playerName}は三塁へ進みます。` : ""}
        一塁の{first?.playerName ?? "走者"}はどうしますか？
      </p>
      <div className="flex flex-col gap-2">
        <button type="button" className="tap tap-accent" onClick={() => onChoose(false)}>
          一塁も2塁へ進む
        </button>
        <button type="button" className="tap" onClick={() => onChoose(true)}>
          一塁はそのまま
        </button>
      </div>
    </Sheet>
  );
}
