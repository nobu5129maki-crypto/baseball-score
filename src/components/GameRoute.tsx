"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

export function GameRoute({ children }: { children: (gameId: string) => ReactNode }) {
  return (
    <Suspense fallback={<p className="p-6 text-[#9aa894]">読み込み中…</p>}>
      <GameRouteInner>{children}</GameRouteInner>
    </Suspense>
  );
}

function GameRouteInner({ children }: { children: (gameId: string) => ReactNode }) {
  const id = useSearchParams().get("id") ?? "";
  return children(id);
}
