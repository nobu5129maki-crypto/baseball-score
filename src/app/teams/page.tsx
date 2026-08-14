"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { KanjiNameField } from "@/components/KanjiNameField";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { decodeRoster, encodeRoster } from "@/lib/roster-share";
import type { Player } from "@/lib/types";

export default function TeamsPage() {
  const router = useRouter();
  const teams = useLiveQuery(() => db.teams.toArray()) ?? [];
  const team = teams[0];
  const players =
    useLiveQuery(() => (team ? db.players.where("teamId").equals(team.id).toArray() : []), [
      team?.id,
    ]) ?? [];
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [teamName, setTeamName] = useState("");
  const [editing, setEditing] = useState<Player | null>(null);
  const [importText, setImportText] = useState("");
  const [share, setShare] = useState("");
  const [saved, setSaved] = useState("");

  async function saveTeam() {
    if (!team) return;
    const next = (teamName.trim() || team.name).trim();
    await db.teams.update(team.id, { name: next });
    setSaved("チーム名を保存しました");
    router.push("/");
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="チーム・選手" backHref="/" />
      <div className="p-4 flex flex-col gap-4">
        {saved ? <p className="text-sm text-[#3ddc84]">{saved}</p> : null}
        <button type="button" className="tap tap-accent" onClick={() => router.push("/")}>
          完了してホームへ
        </button>
        {team ? (
          <div className="flex gap-2">
            <input
              className="tap flex-1 px-3 bg-[#121a14]"
              lang="ja"
              defaultValue={team.name}
              onChange={(e) => setTeamName(e.target.value)}
              aria-label="チーム名"
            />
            <button type="button" className="tap tap-accent px-4" onClick={() => void saveTeam()}>
              保存
            </button>
          </div>
        ) : null}

        <ul className="flex flex-col gap-2">
          {players.map((p) => (
            <li key={p.id} className="rounded-xl border border-[#2c3c30] px-3 py-2">
              {editing?.id === p.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    className="tap px-2 bg-[#070a08] w-20"
                    value={editing.number}
                    onChange={(e) => setEditing({ ...editing, number: e.target.value })}
                    placeholder="背番号"
                  />
                  <KanjiNameField
                    value={editing.name}
                    onChange={(name) => setEditing({ ...editing, name })}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="tap tap-accent flex-1"
                      onClick={() => {
                        void db.players.update(p.id, { name: editing.name, number: editing.number });
                        setEditing(null);
                        setSaved("選手を保存しました");
                      }}
                    >
                      この選手を保存
                    </button>
                    <button type="button" className="tap flex-1" onClick={() => setEditing(null)}>
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-[#9aa894] w-8">{p.number}</span>
                  <span className="flex-1 font-bold">{p.name}</span>
                  <button type="button" className="text-sm" onClick={() => setEditing(p)}>
                    修正
                  </button>
                  <button
                    type="button"
                    className="text-sm text-[#ff5a5a]"
                    onClick={() => void db.players.delete(p.id)}
                  >
                    削除
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#9aa894]">選手を追加</p>
          <input
            className="tap w-24 px-2 bg-[#121a14]"
            placeholder="背番号"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <KanjiNameField value={name} onChange={setName} />
          <button
            type="button"
            className="tap tap-accent"
            onClick={() => {
              if (!team || !name.trim()) return;
              void db.players.add({
                id: newId(),
                teamId: team.id,
                name: name.trim(),
                number: number.trim(),
                createdAt: Date.now(),
              });
              setName("");
              setNumber("");
              setSaved("選手を追加しました");
            }}
          >
            追加
          </button>
        </div>

        <button type="button" className="tap" onClick={() => router.push("/")}>
          ホームに戻る
        </button>

        <div className="border-t border-[#2c3c30] pt-4 flex flex-col gap-2">
          <h2 className="font-bold">メンバー交換</h2>
          <p className="text-sm text-[#9aa894]">同じアプリの相手と、名前・背番号を送り合えます。</p>
          <button
            type="button"
            className="tap"
            onClick={async () => {
              if (!team) return;
              const code = encodeRoster(
                team.name,
                players.map((p) => ({ name: p.name, number: p.number, kana: p.kana })),
              );
              setShare(code);
              try {
                await navigator.clipboard.writeText(code);
                setSaved("コードをコピーしました");
              } catch {
                setSaved("下のコードを相手に送ってください");
              }
            }}
          >
            自分のメンバーをコード化
          </button>
          {share ? (
            <textarea className="tap min-h-24 px-3 py-2 bg-[#070a08] text-xs" readOnly value={share} />
          ) : null}
          <textarea
            className="tap min-h-24 px-3 py-2 bg-[#121a14] text-sm"
            placeholder="受け取ったコードを貼る"
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <button
            type="button"
            className="tap tap-accent"
            onClick={async () => {
              const pack = decodeRoster(importText);
              if (!pack || !team) return;
              await db.rosters.put({
                id: newId(),
                name: pack.name,
                players: pack.players,
                createdAt: Date.now(),
              });
              setSaved(`${pack.name} を対戦相手名簿に保存しました。打順画面で読み込めます。`);
              setImportText("");
            }}
          >
            相手名簿として取り込む
          </button>
        </div>
      </div>
    </main>
  );
}
