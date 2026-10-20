import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell space-y-5">
        <p className="text-sm font-semibold text-zinc-500">404</p>
        <h1 className="text-2xl font-semibold">ページが見つかりません</h1>
        <p className="text-sm text-zinc-600">
          作品が削除されたか、表示できないページです。
        </p>
        <Link className="button-secondary" href="/anime">
          アニメ一覧へ戻る
        </Link>
      </section>
    </main>
  );
}
