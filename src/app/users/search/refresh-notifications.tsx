"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshNotifications() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button className="button-secondary" type="button" disabled={pending} aria-busy={pending}
      onClick={() => startTransition(() => router.refresh())}>
      <RefreshCw aria-hidden="true" size={18} className={pending ? "motion-safe:animate-spin" : undefined} />
      通知を更新
    </button>
  );
}
