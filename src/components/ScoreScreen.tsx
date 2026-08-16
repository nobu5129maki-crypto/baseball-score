"use client";

import { useEffect, useMemo, useState } from "react";
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
  commitBk,
  battingSide,
  fieldingSide,
  getBatter,
  getLineup,
  getPitcher,
  inningLabel,
  needsFieldPosition,
  needsRunnerConfirm,
  needsStrikeThreeChoice,
  canDroppedThird,
  playBlockedReason,
  nextStealBaseOpen,
  previewAfterMoves,
  proposeMoves,
  proposeRunnerHit,
  reduceGame,
  totalRuns,
  undoAtBat,
  undoLast,
} from "@/lib/engine";
import { db, getSettings, saveGame } from "@/lib/db";
import { HIT_RESULTS, OTHER_RESULTS, OUT_RESULTS, PLAY_LABELS } from "@/lib/labels";
import { DROPPED_THIRD } from "@/lib/rules";
import { atBatsThisGame, batterAtBatLine, batterLine, careerGames, slashAcrossGames, slashFor } from "@/lib/stats";
import { POSITION_LABELS } from "@/lib/types";
import type { Base, Dest, Game, LineupSlot, PlayResult, Position, RunnerMove, RunnerOnBase } from "@/lib/types";
import { BsopBar } from "./BsopBar";
import { DefenseSheet } from "./DefenseSheet";
import { DiamondMap } from "./DiamondMap";
import { GlossarySheet } from "./GlossarySheet";
import { InningScoreTable } from "./InningScoreTable";
import { PositionPicker } from "./PositionPicker";
import { Sheet } from "./Sheet";

const OTHER_HELP: Partial<Record<PlayResult, string>> = {
  fielders_choice: "fc",
  sac_bunt: "sh",
  sac_fly: "sf",
  runner_hit: "rh",
};

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
  | "ph"
  | "field"
  | "hit_runner";

export function ScoreScreen({ gameId }: { gameId: string }) {
  const router = useRouter();
  const game = useLiveQuery(() => db.games.get(gameId), [gameId]);
  const players = useLiveQuery(async () => {
    const g = await db.games.get(gameId);
    if (!g) return [];
    return db.players.where("teamId").equals(g.myTeamId).toArray();
  }, [gameId]);
  const allGames = useLiveQuery(() => db.games.toArray(), []);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [glossaryId, setGlossaryId] = useState<string | "index">("index");
  const [glossaryBack, setGlossaryBack] = useState<SheetKind>(null);
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
  const chooseK = needsStrikeThreeChoice(state);
  const allowDroppedThird = canDroppedThird(state);
  const gidpBlocked = playBlockedReason("gidp", state);
  const otherResults = OTHER_RESULTS.filter((r) => !playBlockedReason(r, state));
  const outResults = OUT_RESULTS.filter((r) => !playBlockedReason(r, state));
  const gameSlash = slashFor(game, batter.playerId);
  const slash =
    slashAcrossGames(careerGames(allGames ?? [game], game.myTeamId, game), batter.playerId) ??
    gameSlash;
  const atBats = atBatsThisGame(game, batter, state.half);
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
    if (playBlockedReason(result, state)) return;
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
    if (sheet === "hit_runner") {
      if (!state) return;
      const moves = proposeRunnerHit(state, batter, from);
      setConfirm({ result: "runner_hit", moves, selectedId: null });
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
          {batter.order}番{batter.number ? ` ${batter.number}` : ""} {batter.playerName}
        </p>
        <p className="text-sm text-[#d5dccf]">{POSITION_LABELS[batter.position]}</p>
        <p className="text-sm font-bold mt-1">
          {batterAtBatLine(slash ?? { ab: 0, h: 0, hr: 0, rbi: 0 })}
        </p>
        {atBats.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {atBats.map((ab, i) => (
              <span
                key={`${ab.inning}-${ab.result}-${i}`}
                className="rounded-lg bg-[#070a08] border border-[#2c3c30] px-2 py-1 text-sm font-bold"
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
        selectedId={confirm?.selectedId ?? null}
        edit={Boolean(confirm)}
        showOutButton={Boolean(confirm)}
        onSelectRunner={onSelectRunner}
        onSelectDest={onSelectDest}
      />

      {state.ended && !confirm ? (
        <div className="px-3 pb-4 flex flex-col gap-3">
          <p className="text-center font-bold text-[#f5c518] leading-relaxed">
            {state.bottomUnplayed
              ? "後攻がリードしていたため、この回の裏は行いません。試合終了です。"
              : state.half === "bottom" && totalRuns(state.scores.second) > totalRuns(state.scores.first)
                ? "サヨナラで試合終了です。"
                : "試合終了です。"}
          </p>
          <Link href={`/games/${gameId}/summary`} className="tap tap-accent flex items-center justify-center">
            結果を見る
          </Link>
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
          <div className="px-2 grid grid-cols-4 gap-1 pb-2">
            <Action
              disabled={occupiedCount === 0}
              onClick={() => void patch(commitWp)}
              label="暴投"
              help={() => {
                setGlossaryId("wp");
                setGlossaryBack(null);
                setSheet("glossary");
              }}
            />
            <Action
              disabled={occupiedCount === 0}
              onClick={() => void patch(commitPb)}
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
            <Action
              disabled={occupiedCount === 0}
              onClick={() => setSheet("hit_runner")}
              label="走者当たり"
              help={() => {
                setGlossaryId("rh");
                setGlossaryBack(null);
                setSheet("glossary");
              }}
            />
          </div>
          <div className={`px-2 pb-2 ${leftHanded ? "flex flex-col-reverse" : ""}`}>
            {chooseK ? (
              <div className="mb-2">
                {allowDroppedThird ? (
                  <>
                    <p className="text-sm text-[#f5c518] text-center font-bold mb-2 leading-relaxed">
                      {DROPPED_THIRD.choosePrompt}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" className="tap tap-result tap-out" onClick={() => startResult("strikeout")}>
                        三振
                      </button>
                      <button type="button" className="tap tap-result tap-hit" onClick={() => startResult("dropped_third")}>
                        振り逃げ
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#f5c518] text-center font-bold mb-1 leading-relaxed">
                      {DROPPED_THIRD.strikeoutOnlyPrompt}
                    </p>
                    <p className="text-xs text-[#9aa894] text-center mb-2 leading-relaxed">
                      {DROPPED_THIRD.blockedHint}
                    </p>
                    <button type="button" className="tap tap-result tap-out w-full" onClick={() => startResult("strikeout")}>
                      三振
                    </button>
                  </>
                )}
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
                  {otherResults.length > 0 ? (
                    <button type="button" className="tap tap-result" onClick={() => setSheet("other")}>
                      その他
                    </button>
                  ) : null}
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
      {sheet === "out" ? (
        <ResultSheet title="どんなアウト？" results={outResults} onPick={startResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "other" ? (
        <Sheet title="その他" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-2">
            {otherResults.map((r) => {
              const helpId = OTHER_HELP[r];
              return (
                <div key={r} className="relative">
                  <button type="button" className="tap tap-result w-full" onClick={() => startResult(r)}>
                    {PLAY_LABELS[r]}
                  </button>
                  {helpId ? (
                    <button
                      type="button"
                      className="absolute -top-1 -right-1 w-9 h-9 rounded-full bg-[#070a08] border border-[#2c3c30] text-sm font-bold"
                      aria-label={`${PLAY_LABELS[r]}の解説`}
                      onClick={() => {
                        setGlossaryId(helpId);
                        setGlossaryBack("other");
                        setSheet("glossary");
                      }}
                    >
                      ?
                    </button>
                  ) : null}
                </div>
              );
            })}
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
          onApply={(mut) => void patch(mut)}
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
      {sheet === "hit_runner" ? (
        <RunnerPickSheet
          title="走者当たり"
          hint="打球が当たった走者を1人選んでください。"
          bases={state.bases}
          action={(b, name) => `${b}塁の${name} に当たった`}
          onPick={(from) => {
            const moves = proposeRunnerHit(state, batter, from);
            setConfirm({ result: "runner_hit", moves, selectedId: null });
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
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
            void patch((g) => commitPinchRunner(g, base, player.id, player.name, position, player.number));
            setSheet(null);
          }}
        />
      ) : null}
      {sheet === "ph" ? (
        <PinchHitterSheet
          batter={batter}
          battingLineup={getLineup(state, battingSide(state.half))}
          myTeamBatting={battingSide(state.half) === game.mySide}
          players={players ?? []}
          onClose={() => setSheet(null)}
          onPick={(player) => {
            void patch((g) => commitPinchHitter(g, player.id, player.name, player.number));
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
          {p.number ? `${p.number} ` : ""}
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
  const bench = myTeamBatting ? players.filter((p) => !activeIds.has(p.id)) : [];

  return (
    <Sheet title="代打" onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-3 leading-relaxed">
        今の打者 {batter.order}番 {batter.playerName} を代打にします。ボール・ストライクはそのままです。守備位置を変えたいときは「守備位置・交代」から直せます。
      </p>
      {bench.map((p) => (
        <button
          key={p.id}
          type="button"
          className="tap tap-result tap-accent w-full mb-2"
          onClick={() => onPick(p)}
        >
          {p.number ? `${p.number} ` : ""}
          {p.name} を代打に
        </button>
      ))}
      {myTeamBatting && bench.length === 0 ? (
        <p className="text-sm text-[#9aa894] mb-2">控えがいません。名前を入力しても出せます。</p>
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
