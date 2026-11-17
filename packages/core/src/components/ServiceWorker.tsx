"use client";

import { useEffect } from "react";

// Registers a minimal service worker so the app can be installed. It never caches signed-in pages.
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}
