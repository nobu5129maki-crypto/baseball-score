"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const scope = `${base}/`;
    let reloading = false;
    const onControl = () => {
      if (reloading || !navigator.serviceWorker.controller) return;
      if (sessionStorage.getItem("rakuscore_sw_ready") === "1") return;
      sessionStorage.setItem("rakuscore_sw_ready", "1");
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControl);
    void navigator.serviceWorker.register(`${base}/sw.js`, { scope }).then(() => {
      if (navigator.serviceWorker.controller) {
        sessionStorage.setItem("rakuscore_sw_ready", "1");
      }
    });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControl);
  }, []);
  return null;
}
