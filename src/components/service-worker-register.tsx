"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (dev skips it to avoid stale caches). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((err) => console.error("Service worker registration failed", err));
  }, []);
  return null;
}
