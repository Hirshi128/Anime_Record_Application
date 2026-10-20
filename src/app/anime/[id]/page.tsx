import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";

import { AnimeForm } from "../anime-form";
import { ActionButtonForm } from "@/app/action-button-form";
import { deleteAnime, featureAnime, unfeatureAnime, updateAnime } from "../actions";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { formatDate, statusLabels } from "@/lib/anime-options";
import { parseRecordId } from "@/lib/record-id";

export const dynamic = "force-dynamic";

type AnimeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AnimeDetailPage({ params }: AnimeDetailPageProps) {
  const { id } = await params;
  const animeId = parseRecordId(id);
  const currentUser = await requireCurrentUser();

  if (animeId === null) {
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
            <ArrowLeft aria-hidden="true" size={18} />アニメ一覧へ戻る
          </Link>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="eyebrow">
                Edit Record
              </p>
              <h1 className="mt-3 text-3xl font-semibold">
                {anime.title}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`rating-badge rating-${anime.rating}`}>
                  評価 {anime.rating}
                </span>
                <span className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-600">
                  {statusLabels[anime.status]}
                </span>
                <span className="rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-semibold text-zinc-600">
                  更新 {formatDate(anime.updatedAt)}
                </span>
                {anime.isFeatured ? (
                  <span className="featured-chip">
                    今イチ押し
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 sm:justify-end">
              {anime.isFeatured ? (
                <ActionButtonForm action={unfeatureAction} label="イチ押し解除" className="button-secondary" />
              ) : (
                <ActionButtonForm action={featureAction} label="今イチ押しにする" className="button-primary button-large" disabled={!canFeature} />
              )}
              <ActionButtonForm action={deleteAction} label="削除" pendingLabel="削除中..." className="button-danger" confirmation={`「${anime.title}」の記録を削除しますか？この操作は取り消せません。`} />
              {!canFeature ? (
                <p className="basis-full text-right text-xs font-semibold text-zinc-600">
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
