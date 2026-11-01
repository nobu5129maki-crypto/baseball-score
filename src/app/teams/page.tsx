"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { AppHeader } from "@/components/AppHeader";
import { PlayerProfileFields } from "@/components/PlayerProfileFields";
import {
  addExistingPlayerToTeam,
  addPlayerToTeam,
  createOwnTeam,
  db,
  deleteOwnTeam,
  getSettings,
  linkOverlappingPlayers,
  removePlayerFromTeam,
  savePlayerOnTeam,
  saveTeamName,
  setActiveTeamId,
} from "@/lib/db";
import { newId } from "@/lib/ids";
import { pickPlayerProfile, playerProfileLabel } from "@/lib/player-profile";
import { decodeRoster, encodeRoster } from "@/lib/roster-share";
import {
  numberOnTeam,
  otherTeamLabels,
  normPlayerName,
  planSameNameLinks,
  playerOnTeam,
  playersOnTeam,
  resolveActiveTeam,
  sortOwnTeams,
  teamDisplayName,
} from "@/lib/teams";
import type { Player, PlayerProfile } from "@/lib/types";

export default function TeamsPage() {
  const router = useRouter();
  const teams = sortOwnTeams(useLiveQuery(() => db.teams.toArray()) ?? []);
  const settings = useLiveQuery(() => getSettings());
  const active = resolveActiveTeam(teams, settings?.activeTeamId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const team = teams.find((t) => t.id === selectedId) ?? active ?? teams[0];
  const allPlayers = useLiveQuery(() => db.players.toArray()) ?? [];
  const players = team ? playersOnTeam(allPlayers, team.id) : [];
  const elsewhere = team
    ? allPlayers.filter((player) => !playerOnTeam(player, team.id))
    : [];
  const sameNameLinks = planSameNameLinks(allPlayers);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [draft, setDraft] = useState<PlayerProfile>({});
  const [teamNameDraft, setTeamNameDraft] = useState<{ id: string; name: string } | null>(null);
  const teamName =
    team && teamNameDraft?.id === team.id ? teamNameDraft.name : (team?.name ?? "");
  const [editing, setEditing] = useState<Player | null>(null);
  const [importText, setImportText] = useState("");
  const [share, setShare] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [copyRoster, setCopyRoster] = useState(true);

  function selectTeam(id: string) {
    setSelectedId(id);
    setTeamNameDraft(null);
    setEditing(null);
    void setActiveTeamId(id);
  }

  async function persist() {
    if (!team) return;
    const next = teamName.trim();
    if (next && next !== team.name) {
      await saveTeamName(team.id, next);
      setTeamNameDraft(null);
    }
    if (editing && team) {
      await savePlayerOnTeam({ ...editing, name: editing.name.trim() }, team.id);
      setEditing(null);
    }
  }

  async function finish() {
    if (busy) return;
    setBusy(true);
    try {
      await persist();
      if (team) await setActiveTeamId(team.id);
      router.push("/");
    } finally {
      setBusy(false);
    }
  }

  async function addTeam() {
    if (busy) return;
    const label = newTeamName.trim();
    if (!label) return;
    setBusy(true);
    try {
      await persist();
      const created = await createOwnTeam(label, {
        copyFromTeamId: copyRoster && team ? team.id : undefined,
      });
      if (!created) return;
      setNewTeamName("");
      setSelectedId(created.id);
      setTeamNameDraft(null);
      setEditing(null);
      setSaved(
        copyRoster && team
          ? `${created.name} を追加し、${teamDisplayName(team)} と同じ選手を入れました`
          : `${created.name} を追加しました`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeTeam() {
    if (!team || busy) return;
    const label = teamDisplayName(team);
    if (!window.confirm(`${label} を削除しますか？選手名簿も消えます。試合があるチームは削除できません。`)) {
      return;
    }
    setBusy(true);
    try {
      const result = await deleteOwnTeam(team.id);
      if (result === "last") {
        setSaved("自チームは最低1つ必要です");
      } else if (result === "has_games") {
        setSaved("試合があるチームは削除できません。先に試合を消すか、別チームとして残してください");
      } else if (result === "deleted") {
        setSelectedId(null);
        setTeamNameDraft(null);
        setEditing(null);
        setSaved(`${label} を削除しました`);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="チーム・選手" onBack={() => void finish()} />
      <div className="p-4 flex flex-col gap-4">
        {saved ? <p className="text-sm text-[#3ddc84]">{saved}</p> : null}

        <section className="flex flex-col gap-2">
          <p className="text-sm text-[#9aa894]">自チーム（1部・2部など複数可）</p>
          <div className="flex flex-wrap gap-2">
            {teams.map((t) => {
              const selected = team?.id === t.id;
              const isActive = active?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`tap min-h-12 px-3 text-sm ${selected ? "tap-accent" : ""}`}
                  onClick={() => {
                    void persist().then(() => selectTeam(t.id));
                  }}
                >
                  {t.name}
                  {isActive ? " ·使用中" : ""}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#9aa894] leading-relaxed">
            1部と2部は別チームとして追加してください。名前を変えると、そのチームの過去の試合名だけが変わります。
          </p>
        </section>

        {team ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-[#9aa894]">チーム名</span>
            <input
              className="tap px-3 bg-[#121a14]"
              lang="ja"
              autoCapitalize="off"
              autoComplete="off"
              value={teamName}
              onChange={(e) => team && setTeamNameDraft({ id: team.id, name: e.target.value })}
              aria-label="チーム名"
            />
          </label>
        ) : (
          <p className="text-sm text-[#9aa894]">読み込み中…</p>
        )}

        <button type="button" className="tap tap-accent" disabled={busy || !team} onClick={() => void finish()}>
          完了してホームへ
        </button>

        <section className="rounded-xl border border-[#2c3c30] p-3 flex flex-col gap-2">
          <h2 className="font-bold text-sm">チームを追加</h2>
          <input
            className="tap px-3 bg-[#121a14]"
            lang="ja"
            autoCapitalize="off"
            autoComplete="off"
            placeholder="例: ひまわり2部"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={copyRoster}
              onChange={(e) => setCopyRoster(e.target.checked)}
            />
            いまの選手を、同じ選手として新しいチームにも入れる
          </label>
          <p className="text-xs text-[#9aa894] leading-relaxed">
            1部と2部で同じ選手が出るときは、コピーではなく同じ選手のまま両方の名簿に入ります。名前は共通、背番号はチームごとに変えられます。
          </p>
          <button
            type="button"
            className="tap"
            disabled={busy || !newTeamName.trim()}
            onClick={() => void addTeam()}
          >
            追加してこのチームを使う
          </button>
          {teams.length > 1 ? (
            <button
              type="button"
              className="tap text-[#ff5a5a]"
              disabled={busy || !team}
              onClick={() => void removeTeam()}
            >
              このチームを削除
            </button>
          ) : null}
        </section>

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
                  <input
                    className="tap px-3 bg-[#121a14]"
                    lang="ja"
                    autoCapitalize="off"
                    autoComplete="off"
                    placeholder="選手名"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  />
                  <PlayerProfileFields
                    value={editing}
                    onChange={(next) => setEditing({ ...editing, ...next })}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="tap tap-accent flex-1"
                      onClick={() => {
                        if (!team) return;
                        void savePlayerOnTeam({ ...editing, name: editing.name.trim() }, team.id);
                        setEditing(null);
                        setSaved("選手を保存しました。同じ選手で入っている他のチームにも名前は反映されます");
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
                  <span className="text-[#9aa894] w-8">{team ? numberOnTeam(p, team.id) : p.number}</span>
                  <span className="flex-1 min-w-0">
                    <span className="font-bold">{p.name}</span>
                    {team && otherTeamLabels(p, teams, team.id).length > 0 ? (
                      <span className="block text-xs text-[#f5c518]">
                        {otherTeamLabels(p, teams, team.id).join("・")} と同じ選手
                      </span>
                    ) : null}
                    {playerProfileLabel(p) ? (
                      <span className="block text-xs text-[#9aa894]">{playerProfileLabel(p)}</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="text-sm"
                    onClick={() => setEditing(team ? { ...p, number: numberOnTeam(p, team.id) } : p)}
                  >
                    修正
                  </button>
                  <button
                    type="button"
                    className="text-sm text-[#ff5a5a]"
                    onClick={() => {
                      if (!team) return;
                      const label = p.name.trim() || "この選手";
                      const also = otherTeamLabels(p, teams, team.id);
                      const message = also.length
                        ? `${label}を${teamDisplayName(team)}の名簿から外しますか？${also.join("・")}には残ります。過去の試合の記録も残ります。`
                        : `${label}を選手一覧から削除しますか？過去の試合の記録は残ります。`;
                      if (!window.confirm(message)) return;
                      void removePlayerFromTeam(p.id, team.id);
                    }}
                  >
                    {team && otherTeamLabels(p, teams, team.id).length > 0 ? "外す" : "削除"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-[#9aa894]">選手を追加（{teamDisplayName(team)}）</p>
          <input
            className="tap w-24 px-2 bg-[#121a14]"
            placeholder="背番号"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
          <input
            className="tap px-3 bg-[#121a14]"
            lang="ja"
            autoCapitalize="off"
            autoComplete="off"
            placeholder="選手名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <PlayerProfileFields value={draft} onChange={setDraft} />
          <button
            type="button"
            className="tap tap-accent"
            onClick={() => {
              if (!team || !name.trim()) return;
              const named = name.trim();
              const same = elsewhere.filter((player) => normPlayerName(player.name) === normPlayerName(named));
              if (same.length === 1) {
                void addExistingPlayerToTeam(same[0].id, team.id).then(async (added) => {
                  if (added && number.trim() && number.trim() !== added.number) {
                    await savePlayerOnTeam({ ...added, number: number.trim() }, team.id);
                  }
                });
                setSaved(`${named} は他のチームにいるので、同じ選手として追加しました`);
              } else {
                void addPlayerToTeam(team.id, { name: named, number: number.trim(), ...pickPlayerProfile(draft) });
                setSaved("選手を追加しました");
              }
              setName("");
              setNumber("");
              setDraft({});
            }}
          >
            追加
          </button>
        </div>

        {elsewhere.length > 0 && team ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-[#9aa894]">他の自チームにいる選手</p>
            {elsewhere.map((player) => (
              <button
                key={player.id}
                type="button"
                className="tap text-sm text-left"
                onClick={() => {
                  void addExistingPlayerToTeam(player.id, team.id);
                  setSaved(`${player.name} を${teamDisplayName(team)}にも入れました`);
                }}
              >
                {player.name} をこのチームにも入れる
                <span className="block text-xs text-[#9aa894]">
                  {otherTeamLabels(player, teams, team.id).join("・") || "他チーム"}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {sameNameLinks.length > 0 ? (
          <button
            type="button"
            className="tap"
            onClick={() => {
              const names = sameNameLinks.map((link) => link.name).join("、");
              if (!window.confirm(`${names} を、1部と2部で同じ選手として結びつけますか？試合の記録も同じ選手にまとまります。`)) {
                return;
              }
              void linkOverlappingPlayers().then((count) => {
                setSaved(count > 0 ? `${count}人を同じ選手として結びつけました` : "結びつける選手はいませんでした");
              });
            }}
          >
            同名の選手を同じ選手として結びつける
          </button>
        ) : null}

        <div className="border-t border-[#2c3c30] pt-4 flex flex-col gap-2">
          <h2 className="font-bold">メンバー交換</h2>
          <p className="text-sm text-[#9aa894]">同じアプリの相手と、名前・背番号を送り合えます。</p>
          <button
            type="button"
            className="tap"
            onClick={async () => {
              if (!team) return;
              const code = encodeRoster(
                teamName.trim() || team.name,
                players.map((p) => ({
                  name: p.name,
                  number: p.number,
                  kana: p.kana,
                  ...pickPlayerProfile(p),
                })),
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
