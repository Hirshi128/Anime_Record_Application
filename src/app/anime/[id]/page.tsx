import Link from "next/link";
import { notFound } from "next/navigation";

import { AnimeForm } from "../anime-form";
import { deleteAnime, featureAnime, unfeatureAnime, updateAnime } from "../actions";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabels } from "@/lib/anime-options";

export const dynamic = "force-dynamic";

type AnimeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { id } = await params;
  const animeId = Number(id);
  const currentUser = await requireCurrentUser();

  if (!Number.isInteger(animeId) || animeId <= 0) {
    notFound();
  }

  const anime = await prisma.anime.findFirst({
    where: {
      id: animeId,
      userId: currentUser.id,
    },
    include: {
      tags: {
        include: {
          tag: true,
        },
        orderBy: {
          tag: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!anime) {
    notFound();
  }

  const featuredCount = await prisma.anime.count({
    where: {
      userId: currentUser.id,
      isFeatured: true,
    },
  });

  const tagNames = anime.tags.map((animeTag) => animeTag.tag.name);
  const updateAction = updateAnime.bind(null, id);
  const deleteAction = deleteAnime.bind(null, id);
  const featureAction = featureAnime.bind(null, id);
  const unfeatureAction = unfeatureAnime.bind(null, id);
  const canFeature = anime.isFeatured || featuredCount < 3;

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-4xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content">
          <Link
            className="button-secondary"
            href="/anime"
          >
            ← アニメ一覧へ戻る
          </Link>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">
                Edit Record
              </p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                {anime.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rating-badge rating-${anime.rating}`}>
                  評価 {anime.rating}
                </span>
                <span className="rounded-md border border-white/30 bg-white/16 px-3 py-1 text-sm font-semibold text-white">
                  {statusLabels[anime.status]}
                </span>
                <span className="rounded-md border border-white/30 bg-white/16 px-3 py-1 text-sm font-semibold text-white">
                  更新 {formatDate(anime.updatedAt)}
                </span>
                {anime.isFeatured ? (
                  <span className="rounded-md border border-amber-200/70 bg-amber-200/20 px-3 py-1 text-sm font-semibold text-amber-50">
                    今イチ押し
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              {anime.isFeatured ? (
                <form action={unfeatureAction}>
                  <button
                    className="button-secondary"
                    type="submit"
                  >
                    イチ押し解除
                  </button>
                </form>
              ) : (
                <form action={featureAction}>
                  <button
                    className="button-primary"
                    disabled={!canFeature}
                    type="submit"
                  >
                    今イチ押しにする
                  </button>
                </form>
              )}
              <form action={deleteAction}>
                <button
                  className="button-danger"
                  type="submit"
                >
                  削除
                </button>
              </form>
              {!canFeature ? (
                <p className="basis-full text-right text-xs font-semibold text-amber-100">
                  今イチ押しは3件までです。別の作品を解除してから選べます。
                </p>
              ) : null}
            </div>
          </div>
          </div>
        </header>

        <AnimeForm
          action={updateAction}
          anime={{
            title: anime.title,
            rating: anime.rating,
            status: anime.status,
            review: anime.review,
            tags: tagNames,
          }}
          submitLabel="更新"
        />
      </section>
    </main>
  );
}
