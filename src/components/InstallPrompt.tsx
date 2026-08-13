"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function subscribeNever() {
  return () => undefined;
}

export function InstallPrompt() {
  const standalone = useSyncExternalStore(subscribeNever, isStandalone, () => false);
  const ios = useSyncExternalStore(subscribeNever, isIos, () => false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || installed) return null;

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setDeferred(null);
  }

  return (
    <div className="rounded-2xl border border-[#f5c518] bg-[#1a281c] p-4">
      <p className="font-bold">ホーム画面に追加</p>
      {deferred ? (
        <>
          <p className="text-sm text-[#d5dccf] mt-1">
            アプリとして開き、電波の弱いグラウンドでも使えます。
          </p>
          <button type="button" className="tap tap-accent w-full mt-3" onClick={() => void install()}>
            今すぐ追加する
          </button>
        </>
      ) : ios ? (
        <p className="text-sm text-[#d5dccf] mt-1 leading-relaxed">
          Safari の共有ボタン（四角から矢印）→「ホーム画面に追加」をタップしてください。
        </p>
      ) : (
        <p className="text-sm text-[#d5dccf] mt-1 leading-relaxed">
          ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。Android
          は HTTPS で開いているときにインストールできます。
        </p>
      )}
    </div>
  );
}
