"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InstallPrompt } from "@/components/InstallPrompt";
import {
  backupFileName,
  backupSummary,
  collectBackup,
  parseBackup,
  stringifyBackup,
} from "@/lib/backup";
import { mergeBackup, mergeSummary } from "@/lib/backup-merge";
import { deliverBackupFile } from "@/lib/backup-export";

export default function SettingsPage() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
        `${backupSummary(backup)}を書き出しました。ほかの人に送るか、ファイルアプリに残してください。`,
      );
    } catch {
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
        `受け取ったデータを、今の成績に足します。今ある試合は消えません。\n${backupSummary(parsed.backup)}を取り込みますか？`,
      );
      if (!ok) return;
      const result = await mergeBackup(parsed.backup);
      setMessage(mergeSummary(result));
    } catch {
      setError("読み込めませんでした。らくスコアのバックアップファイルか確認してください。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full min-h-dvh">
      <AppHeader title="バックアップ" backHref="/" />
      <div className="p-4 flex flex-col gap-4">
        <InstallPrompt />

        <section className="rounded-2xl border border-[#2c3c30] p-4 flex flex-col gap-3">
          <h2 className="font-bold">データの書き出し・読み込み</h2>
          <p className="text-sm text-[#9aa894] leading-relaxed">
            試合・チーム・選手のデータをファイルに残したり、ほかの人のデータを今の成績に足したりできます。同じ選手は名前と背番号で結びます。読み込んでも、今ある試合は消えません。
          </p>
          <button type="button" className="tap tap-accent" disabled={busy} onClick={() => void exportBackup()}>
            {busy ? "処理中…" : "データを書き出す"}
          </button>
          <button type="button" className="tap" disabled={busy} onClick={() => fileRef.current?.click()}>
            データを読み込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="バックアップファイルを選ぶ"
            onChange={(e) => void onPickFile(e)}
          />
          {message ? <p className="text-sm text-[#3ddc84]">{message}</p> : null}
          {error ? <p className="text-sm text-[#ff5a5a]">{error}</p> : null}
        </section>

        <p className="text-sm text-[#9aa894]">
          試合データはこの端末に保存されます。電波がなくても記録できます。端末のデータを消す前に、バックアップを書き出しておくと安心です。
        </p>
      </div>
    </main>
  );
}
