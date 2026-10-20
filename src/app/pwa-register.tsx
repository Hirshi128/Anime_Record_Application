"use client";

import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribeConnection(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => { window.removeEventListener("online", callback); window.removeEventListener("offline", callback); };
}

export function ConnectionStatus() {
  const online = useSyncExternalStore(subscribeConnection, () => navigator.onLine, () => true);
  return online ? null : <span className="inline-flex items-center gap-2 text-xs text-zinc-600" role="status"><WifiOff size={16} aria-hidden="true" />オフライン</span>;
}

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const warm = async () => {
      await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      const urls = performance.getEntriesByType("resource").map(entry => entry.name).filter(value => {
        const url = new URL(value, location.origin);
        return url.origin === location.origin && url.pathname.startsWith("/_next/static/");
      });
      registration.active?.postMessage({ type: "CACHE_PERSONAL_ASSETS", urls });
    };
    void warm().catch(() => {
      // HTTPのLANアクセスなど、Service Workerが使えない環境では静かに無効化します。
    });
  }, []);

  return null;
}
