"use client";

import { useEffect } from "react";
import { requestDurableStorage } from "@/lib/persist-storage";
import { ensureSeed } from "@/lib/seed";

export function DbBootstrap() {
  useEffect(() => {
    void requestDurableStorage();
    void ensureSeed();
  }, []);
  return null;
}
