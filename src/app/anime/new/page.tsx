import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { AnimeForm } from "../anime-form";
import { createAnime } from "../actions";
import { requireCurrentUser } from "@/lib/current-user";
import { registrationTitle } from "@/lib/anime-registration";

export default async function AnimeNewPage({ searchParams }: {
  searchParams: Promise<{ title?: string | string[] }>;
}) {
  const currentUser = await requireCurrentUser();
  const initialTitle = registrationTitle((await searchParams).title);

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-4xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content space-y-6">
          <Link
            className="button-secondary"
            href="/anime"
          >
            <ArrowLeft aria-hidden="true" size={18} />アニメ一覧へ戻る
          </Link>
          <div>
            <p className="eyebrow">New Record</p>
            <h1 className="mt-3 text-3xl font-semibold">
              アニメ登録
            </h1>
            <p className="mt-3 text-sm text-zinc-600">
              {currentUser.displayName}さんの新しい記録
            </p>
          </div>
          </div>
        </header>

        <AnimeForm key={`${currentUser.id}:${initialTitle}`} action={createAnime} anime={{ title: initialTitle }} submitLabel="保存" />
      </section>
    </main>
  );
}
