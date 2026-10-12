"use client";

import { useEffect } from "react";
import { enableAnalytics } from "@/lib/firebase";

/** Boots Firebase Analytics in the browser; silently no-ops if unsupported. */
export function Analytics() {
  useEffect(() => {
    void enableAnalytics();
  }, []);

  return null;
}