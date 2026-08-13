"use client";

import type { ReactNode } from "react";
import Link from "next/link";

export function AppHeader({
  title,
  backHref,
  trailing,
}: {
  title: string;
  backHref?: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-2 px-3 py-2 min-h-14 border-b border-[#2c3c30]">
      {backHref ? (
        <Link href={backHref} className="tap tap-ghost px-3 text-sm">
          ←
        </Link>
      ) : (
        <span className="w-10" />
      )}
      <h1 className="flex-1 text-center text-base font-bold">{title}</h1>
      <div className="min-w-10 flex justify-end">{trailing}</div>
    </header>
  );
}
