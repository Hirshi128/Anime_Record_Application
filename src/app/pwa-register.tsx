"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // HTTPのLANアクセスなど、Service Workerが使えない環境では静かに無効化します。
    });
  }, []);

  return null;
}
