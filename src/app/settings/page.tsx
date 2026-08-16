"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  backupFileName,
  backupSummary,
  collectBackup,
  parseBackup,
  restoreBackup,
  stringifyBackup,
} from "@/lib/backup";
import { mergeBackup, mergeSummary } from "@/lib/backup-merge";
import { deliverBackupFile } from "@/lib/backup-export";
import { db, getSettings } from "@/lib/db";

export default function SettingsPage() {
  const [leftHanded, setLeftHanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const mergeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void getSettings().then((s) => setLeftHanded(s.leftHanded));
  }, []);

  async function exportBackup() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const backup = await collectBackup();
      const text = stringifyBackup(backup);
      const name = backupFileName(backup.exportedAt);
      const file = new File([text], name, { type: "application/json" });
      const delivered = await deliverBackupFile(file, { title: "らくスコア 記録" });
      if (delivered === "cancelled") return;
      setMessage(
        `${backupSummary(backup)}を書き出しました。LINEやメールで集計係に送るか、ファイルアプリに残してください。`,
      );
    } catch {
      setError("書き出せませんでした。もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

  async function onPickMerge(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      const ok = window.confirm(
        `受け取った記録を、今の成績に足します。今ある試合は消えません。\n${backupSummary(parsed.backup)}を取り込みますか？`,
      );
      if (!ok) return;
      const result = await mergeBackup(parsed.backup);
      setMessage(mergeSummary(result));
    } catch {
      setError("足し合わせできませんでした。らくスコアの記録ファイルか確認してください。");
    } finally {
      setBusy(false);
    }
  }

  async function onPickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      const ok = window.confirm(
        `今の試合データは、ファイルの内容に置き換わります。\n${backupSummary(parsed.backup)}を読み込みますか？`,
      );
      if (!ok) return;
      await restoreBackup(parsed.backup);
      setMessage(`${backupSummary(parsed.backup)}を読み込みました。`);
      window.location.assign("/");
    } catch {
      setError("読み込めませんでした。らくスコアのバックアップファイルか確認してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="設定" backHref="/" />
      <div className="p-4 flex flex-col gap-4">
        <InstallPrompt />
        <label className="flex items-center justify-between rounded-2xl border border-[#2c3c30] p-4">
          <span>
            <span className="block font-bold">左利きレイアウト</span>
            <span className="text-sm text-[#9aa894]">カウントボタンを下に、結果ボタンを上にします</span>
          </span>
          <input
            type="checkbox"
            checked={leftHanded}
            className="w-6 h-6"
            onChange={(e) => {
              const v = e.target.checked;
              setLeftHanded(v);
              void db.settings.put({ id: "app", leftHanded: v });
            }}
          />
        </label>

        <section className="rounded-2xl border border-[#2c3c30] p-4 flex flex-col gap-3">
          <h2 className="font-bold">ほかの人の記録を足す</h2>
          <p className="text-sm text-[#9aa894] leading-relaxed">
            集計係が休んで、別の人が記録したとき。記録した人がファイルを送り、集計係がここで足し合わせます。同じ選手は名前と背番号で結びます。今ある試合は消えません。
          </p>
          <button type="button" className="tap tap-accent" disabled={busy} onClick={() => void exportBackup()}>
            この端末の記録を送る
          </button>
          <button type="button" className="tap" disabled={busy} onClick={() => mergeRef.current?.click()}>
            受け取った記録を足し合わせる
          </button>
          <input
            ref={mergeRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onPickMerge(e)}
          />
          {message ? <p className="text-sm text-[#3ddc84]">{message}</p> : null}
          {error ? <p className="text-sm text-[#ff5a5a]">{error}</p> : null}
        </section>

        <section className="rounded-2xl border border-[#2c3c30] p-4 flex flex-col gap-3">
          <h2 className="font-bold">データのバックアップ</h2>
          <p className="text-sm text-[#9aa894] leading-relaxed">
            試合・チーム・選手をファイルに残します。スマホの閲覧データを消す前に書き出してください。読み込むと、今のデータをファイルの内容に入れ替えます。
          </p>
          <button type="button" className="tap" disabled={busy} onClick={() => void exportBackup()}>
            バックアップを書き出す
          </button>
          <button
            type="button"
            className="tap"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            バックアップを読み込む（入れ替え）
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => void onPickFile(e)}
          />
          {message ? <p className="text-sm text-[#3ddc84]">{message}</p> : null}
          {error ? <p className="text-sm text-[#ff5a5a]">{error}</p> : null}
        </section>

        <p className="text-sm text-[#9aa894]">
          試合データはこの端末に保存されます。電波がなくても記録できます。
        </p>
      </div>
    </main>
  );
}
