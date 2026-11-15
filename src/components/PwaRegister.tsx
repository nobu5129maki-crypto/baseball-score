"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    void navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
  }, []);
  return null;
}
