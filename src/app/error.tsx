"use client";

import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="p-6 max-w-lg mx-auto">
      <p className="font-bold text-lg">画面を読み込めませんでした</p>
      <p className="text-sm text-[#9aa894] mt-2 break-all">{error.message || "不明なエラー"}</p>
      <div className="flex gap-2 mt-4">
        <button type="button" className="tap tap-accent flex-1" onClick={reset}>
          やり直す
        </button>
        <Link href="/" className="tap flex-1 flex items-center justify-center">
          ホーム
        </Link>
      </div>
    </main>
  );
}
