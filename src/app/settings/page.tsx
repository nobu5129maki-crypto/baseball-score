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
import { db, getSettings } from "@/lib/db";

export default function SettingsPage() {
  const [leftHanded, setLeftHanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
      const shared = await shareBackup(file);
      if (!shared) downloadBackup(file);
      setMessage(
        `${backupSummary(backup)}を書き出しました。メールやファイルアプリに残すと、履歴を消しても戻せます。`,
      );
    } catch (err) {
      if (isAbort(err)) return;
      setError("書き出せませんでした。もう一度試してください。");
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
          <h2 className="font-bold">データのバックアップ</h2>
          <p className="text-sm text-[#9aa894] leading-relaxed">
            試合・チーム・選手をファイルに残します。スマホの閲覧データを消す前に書き出してください。
          </p>
          <button type="button" className="tap tap-accent" disabled={busy} onClick={() => void exportBackup()}>
            バックアップを書き出す
          </button>
          <button
            type="button"
            className="tap"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            バックアップを読み込む
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

async function shareBackup(file: File): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (!nav.share || !nav.canShare?.({ files: [file] })) return false;
  await nav.share({ files: [file], title: "らくスコア バックアップ" });
  return true;
}

function downloadBackup(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAbort(err: unknown): boolean {
  return typeof err === "object" && err !== null && "name" in err && (err as { name: string }).name === "AbortError";
}
