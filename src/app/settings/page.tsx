"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { InstallPrompt } from "@/components/InstallPrompt";
import { db, getSettings } from "@/lib/db";

export default function SettingsPage() {
  const [leftHanded, setLeftHanded] = useState(false);

  useEffect(() => {
    void getSettings().then((s) => setLeftHanded(s.leftHanded));
  }, []);

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
        <p className="text-sm text-[#9aa894]">
          試合データはこの端末に保存されます。電波がなくても記録できます。
        </p>
      </div>
    </main>
  );
}
