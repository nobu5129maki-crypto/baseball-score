"use client";

import { useEffect } from "react";
import { ensureSeed } from "@/lib/seed";

export function DbBootstrap() {
  useEffect(() => {
    void ensureSeed();
  }, []);
  return null;
}
