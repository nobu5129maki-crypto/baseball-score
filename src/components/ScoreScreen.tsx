"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import {
  commitEnd,
  commitPb,
  commitPitch,
  commitPlay,
  commitSteal,
  commitSub,
  commitWp,
  getBatter,
  inningLabel,
  needsRunnerConfirm,
  proposeMoves,
  reduceGame,
  totalRuns,
  undoAtBat,
  undoLast,
} from "@/lib/engine";
import { db, getSettings, saveGame } from "@/lib/db";
import { HIT_RESULTS, OTHER_RESULTS, OUT_RESULTS, PLAY_LABELS } from "@/lib/labels";
import { POSITION_LABELS } from "@/lib/types";
import type { Dest, Game, PlayResult, RunnerMove, RunnerOnBase, Side } from "@/lib/types";
import { BsopBar } from "./BsopBar";
import { DiamondMap } from "./DiamondMap";
import { GlossarySheet } from "./GlossarySheet";
import { InningScoreTable } from "./InningScoreTable";
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
  | "cs";

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
  const [confirm, setConfirm] = useState<{
    result: PlayResult;
    moves: RunnerMove[];
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
  const firstName = game.mySide === "first" ? game.myTeamName : game.opponentName;
  const secondName = game.mySide === "second" ? game.myTeamName : game.opponentName;
  const occupiedCount = state.bases.filter(Boolean).length;

  async function patch(mut: (g: Game) => Game) {
    const latest = await db.games.get(gameId);
    if (!latest) return;
    await saveGame(mut(latest));
  }

  function chooseResult(result: PlayResult) {
    setSheet(null);
    if (!state) return;
    if (needsRunnerConfirm(result, state)) {
      setConfirm({
        result,
        moves: proposeMoves(result, state, batter),
        selectedId: null,
      });
      return;
    }
    void patch((g) => commitPlay(g, result));
  }

  function onSelectRunner(runner: RunnerOnBase, from: 0 | 1 | 2 | 3) {
    if (sheet === "steal") {
      if (from === 0) return;
      const to: Dest = from === 3 ? 4 : ((from + 1) as Dest);
      void patch((g) => commitSteal(g, from, to));
      setSheet(null);
      return;
    }
    if (sheet === "cs" && from !== 0) {
      void patch((g) => commitSteal(g, from, "out"));
      setSheet(null);
      return;
    }
    if (!confirm) return;
    setConfirm({ ...confirm, selectedId: runner.playerId });
  }

  function onSelectDest(to: Dest) {
    if (!state || !confirm) return;
    if (!confirm.selectedId) {
      const batterMove = confirm.moves.find((m) => m.from === 0);
      if (batterMove) {
        setConfirm({
          ...confirm,
          moves: confirm.moves.map((m) =>
            m.playerId === batterMove.playerId ? { ...m, to } : m,
          ),
        });
      }
      return;
    }
    const selected = confirm.selectedId;
    const from =
      confirm.moves.find((m) => m.playerId === selected)?.from ??
      ((state.bases.findIndex((b) => b?.playerId === selected) + 1 || 0) as 0 | 1 | 2 | 3);
    const rest = confirm.moves.filter((m) => m.playerId !== selected);
    setConfirm({
      ...confirm,
      moves: [...rest, { playerId: selected, from, to }],
      selectedId: null,
    });
  }

  const previewBases = confirm
    ? reduceGame({
        ...game,
        events: [
          ...game.events,
          {
            id: "preview",
            seq: 99999,
            t: "play",
            result: confirm.result,
            moves: confirm.moves,
          },
        ],
      }).bases
    : state.bases;

  return (
    <main className="flex flex-col min-h-dvh max-w-lg mx-auto w-full">
      <header className="flex items-center gap-2 px-2 py-2 min-h-14 border-b border-[#2c3c30]">
        <Link href="/" className="tap tap-ghost px-3 text-sm">
          ←
        </Link>
        <div className="flex-1 text-center">
          <p className="font-bold">{inningLabel(state.inning, state.half)}</p>
          <p className="text-sm">
            {firstName} {totalRuns(state.scores.first)} — {totalRuns(state.scores.second)}{" "}
            {secondName}
          </p>
        </div>
        <button type="button" className="tap tap-ghost px-3 text-sm" onClick={() => setSheet("menu")}>
          ⋯
        </button>
      </header>

      <BsopBar state={state} />

      <p className="px-3 py-1 text-sm text-[#9aa894]">
        今の打者 {batter.order}番 {batter.playerName}（{POSITION_LABELS[batter.position]}）
      </p>

      <DiamondMap
        state={{ ...state, bases: previewBases }}
        batterName={batter.playerName}
        selectedId={confirm?.selectedId ?? null}
        edit={Boolean(confirm) || sheet === "steal" || sheet === "cs"}
        onSelectRunner={onSelectRunner}
        onSelectDest={onSelectDest}
      />

      {confirm ? (
        <div className="px-3 pb-2 flex gap-2">
          <button type="button" className="tap flex-1" onClick={() => setConfirm(null)}>
            やり直す
          </button>
          <button
            type="button"
            className="tap tap-accent flex-1"
            onClick={() => {
              const result = confirm.result;
              const moves = confirm.moves;
              setConfirm(null);
              void patch((g) => commitPlay(g, result, moves));
            }}
          >
            {PLAY_LABELS[confirm.result]}で確定
          </button>
        </div>
      ) : (
        <>
          <div className="px-2 flex gap-2 pb-1">
            <Action
              disabled={occupiedCount === 0}
              onClick={() => setSheet("steal")}
              label="盗塁"
            />
            <Action
              disabled={occupiedCount === 0}
              onClick={() => setSheet("cs")}
              label="盗塁死"
            />
            <Action disabled={occupiedCount === 0} onClick={() => void patch(commitWp)} label="暴投" help={() => { setGlossaryId("wp"); setSheet("glossary"); }} />
            <Action disabled={occupiedCount === 0} onClick={() => void patch(commitPb)} label="捕逸" help={() => { setGlossaryId("pb"); setSheet("glossary"); }} />
          </div>
          {sheet === "steal" || sheet === "cs" ? (
            <p className="px-3 pb-2 text-sm text-[#f5c518]">
              {sheet === "steal"
                ? "進塁させる走者をダイヤモンドでタップ"
                : "アウトにする走者をダイヤモンドでタップ"}
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
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button type="button" className="tap tap-result tap-accent" onClick={() => setSheet("hit")}>
                ヒット
              </button>
              <button type="button" className="tap tap-result" onClick={() => setSheet("out")}>
                アウト
              </button>
              <button type="button" className="tap tap-result" onClick={() => chooseResult("strikeout")}>
                三振
              </button>
              <button type="button" className="tap tap-result" onClick={() => chooseResult("walk")}>
                四球
              </button>
              <button type="button" className="tap tap-result" onClick={() => chooseResult("hbp")}>
                死球
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
        <ResultSheet title="どんなヒット？" results={HIT_RESULTS} onPick={chooseResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "out" ? (
        <ResultSheet title="どんなアウト？" results={OUT_RESULTS} onPick={chooseResult} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "other" ? (
        <Sheet title="その他" onClose={() => setSheet(null)}>
          <div className="grid grid-cols-2 gap-2">
            {OTHER_RESULTS.map((r) => (
              <div key={r} className="relative">
                <button type="button" className="tap tap-result w-full" onClick={() => chooseResult(r)}>
                  {PLAY_LABELS[r]}
                </button>
                {r === "fielders_choice" || r === "sac_bunt" || r === "sac_fly" ? (
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-8 h-8 rounded-full bg-[#070a08] text-sm"
                    onClick={() => {
                      setGlossaryId(r === "fielders_choice" ? "fc" : r === "sac_bunt" ? "sh" : "sf");
                      setSheet("glossary");
                    }}
                  >
                    ?
                  </button>
                ) : null}
              </div>
            ))}
            <button
              type="button"
              className="tap col-span-2"
              onClick={() => {
                setGlossaryId("index");
                setSheet("glossary");
              }}
            >
              これのこと？ 一覧
            </button>
          </div>
        </Sheet>
      ) : null}
      {sheet === "glossary" ? (
        <GlossarySheet termId={glossaryId} onClose={() => setSheet(null)} />
      ) : null}
      {sheet === "menu" ? (
        <Sheet title="試合メニュー" onClose={() => setSheet(null)}>
          <div className="flex flex-col gap-3">
            <InningScoreTable state={state} firstName={firstName} secondName={secondName} />
            <button type="button" className="tap w-full" onClick={() => setSheet("sub")}>
              選手交代
            </button>
            <button
              type="button"
              className="tap w-full"
              onClick={() => {
                setGlossaryId("index");
                setSheet("glossary");
              }}
            >
              これのこと？
            </button>
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
          side={game.mySide}
          players={players ?? []}
          onClose={() => setSheet(null)}
          onSub={(s, order, playerId, playerName, position) => {
            void patch((g) => commitSub(g, s, order, playerId, playerName, position));
            setSheet(null);
          }}
        />
      ) : null}

      {state.regulationComplete && !state.ended ? (
        <p className="px-3 pb-4 text-center text-sm text-[#f5c518]">規定回が終わりました。⋯ から試合終了できます。</p>
      ) : null}
    </main>
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
      <button type="button" className="tap w-full text-sm" disabled={disabled} onClick={onClick}>
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
  game,
  side,
  players,
  onClose,
  onSub,
}: {
  game: Game;
  side: Side;
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
  const lineup = side === "first" ? game.firstLineup : game.secondLineup;
  const slot = lineup.find((s) => s.order === order) ?? lineup[0];
  const activeIds = new Set(lineup.map((s) => s.playerId));
  const bench = players.filter((p) => !activeIds.has(p.id));

  return (
    <Sheet title="選手交代" onClose={onClose}>
      <p className="text-sm text-[#9aa894] mb-2">打順</p>
      <div className="grid grid-cols-9 gap-1 mb-3">
        {lineup.map((s) => (
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
        {slot.order}番 {slot.playerName} →
      </p>
      {bench.length === 0 ? (
        <p className="text-sm text-[#9aa894]">控えがいません。チームに選手を追加してください。</p>
      ) : (
        <div className="flex flex-col gap-2">
          {bench.map((p) => (
            <button
              key={p.id}
              type="button"
              className="tap w-full"
              onClick={() => onSub(side, slot.order, p.id, p.name, slot.position)}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
