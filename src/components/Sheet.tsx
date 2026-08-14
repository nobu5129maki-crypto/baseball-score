"use client";

import type { ReactNode } from "react";

export function Sheet({
  title,
  children,
  onClose,
  tall,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  tall?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="flex-1 bg-black/70"
        aria-label="閉じる"
        onClick={onClose}
      />
      <div
        className={`rounded-t-2xl bg-[#121a14] border-t border-[#2c3c30] p-4 pb-8 overflow-y-auto ${
          tall ? "max-h-[92dvh]" : "max-h-[80vh]"
        }`}
      >
        <div className="flex items-center mb-3">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <button type="button" className="tap tap-ghost px-3 text-sm" onClick={onClose}>
            閉じる
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
