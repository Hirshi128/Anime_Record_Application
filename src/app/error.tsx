"use client";

import Link from "next/link";

export default function ErrorPage({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell space-y-5" role="alert">
        <h1 className="text-2xl font-semibold">ページを表示できませんでした</h1>
        <p className="text-sm text-zinc-600">
          接続を確認して、もう一度お試しください。
        </p>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" onClick={retry}>
            再試行
          </button>
          <Link className="button-secondary" href="/">
            ホームへ戻る
          </Link>
        </div>
      </section>
    </main>
  );
}
