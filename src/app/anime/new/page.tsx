import Link from "next/link";

import { AnimeForm } from "../anime-form";
import { createAnime } from "../actions";
import { requireCurrentUser } from "@/lib/current-user";

export default async function AnimeNewPage() {
  const currentUser = await requireCurrentUser();

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-4xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content space-y-6">
          <Link
            className="button-secondary"
            href="/anime"
          >
            ← アニメ一覧へ戻る
          </Link>
          <div>
            <p className="eyebrow">New Record</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
              アニメ登録
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
              {currentUser.displayName}さんの評価や感想を残して、あとから自分の好みを振り返れるようにします。
            </p>
          </div>
          </div>
        </header>

        <AnimeForm action={createAnime} submitLabel="保存" />
      </section>
    </main>
  );
}
