import Link from "next/link";

import { logoutUser } from "@/app/users/actions";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import {
  formatDate,
  genreOptions,
  isGenre,
  isRating,
  isWatchStatus,
  ratingOptions,
  statusLabels,
  statusOptions,
} from "@/lib/anime-options";
import type { Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

type AnimeListPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    rating?: string | string[];
    status?: string | string[];
    tag?: string | string[];
    tagMode?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function getParams(value: string | string[] | undefined) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export default async function AnimeListPage({
  searchParams,
}: AnimeListPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const rating = getParam(params.rating);
  const status = getParam(params.status);
  const tagMode = getParam(params.tagMode) === "all" ? "all" : "any";
  const currentUser = await requireCurrentUser();
  const selectedGenres = Array.from(
    new Set(getParams(params.tag).map((genre) => genre.trim()).filter(isGenre)),
  );

  const genreFilter =
    selectedGenres.length === 0
      ? {}
      : tagMode === "all"
        ? {
            AND: selectedGenres.map((genre) => ({
              tags: {
                some: {
                  tag: {
                    name: genre,
                  },
                },
              },
            })),
          }
        : {
            OR: selectedGenres.map((genre) => ({
              tags: {
                some: {
                  tag: {
                    name: genre,
                  },
                },
              },
            })),
          };

  const where: Prisma.AnimeWhereInput = {
    AND: [
      { userId: currentUser.id },
      query
        ? {
            OR: [
              { title: { contains: query } },
              { review: { contains: query } },
              {
                tags: {
                  some: {
                    tag: {
                      name: { contains: query },
                    },
                  },
                },
              },
            ],
          }
        : {},
      isRating(rating) ? { rating } : {},
      isWatchStatus(status) ? { status } : {},
      genreFilter,
    ],
  };

  const [animeList, featuredAnimeList, pendingFriendRequestCount] = await Promise.all([
    prisma.anime.findMany({
      where,
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
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.anime.findMany({
      where: {
        userId: currentUser.id,
        isFeatured: true,
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
      orderBy: [
        {
          featuredAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
      take: 3,
    }),
    prisma.friendRequest.count({
      where: {
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
    }),
  ]);

  const hasFilters = Boolean(
    query || isRating(rating) || isWatchStatus(status) || selectedGenres.length,
  );

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell space-y-8">
        <header className="record-hero">
          <div className="record-hero-content flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <Link
              className="button-secondary mb-5"
              href="/"
            >
              ← ホームへ戻る
            </Link>
            <p className="eyebrow">Library</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
              アニメ一覧
            </h1>
            <p className="mt-3 text-sm text-white/78">
              {currentUser.displayName}さんの記録 / {animeList.length}件
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link className="button-secondary w-fit" href="/users">
              ユーザー切替
            </Link>
            <Link className="button-secondary w-fit" href="/users/profile">
              プロフィール登録
            </Link>
            <Link
              className="button-secondary button-with-notification w-fit"
              href="/users/search"
            >
              フレンド検索
              {pendingFriendRequestCount > 0 ? (
                <span aria-hidden="true" className="friend-alert-mark">
                  !
                </span>
              ) : null}
            </Link>
            <form action={logoutUser}>
              <button className="button-secondary" type="submit">
                ログアウト
              </button>
            </form>
            <Link className="button-primary w-fit" href="/anime/new">
              新規登録
            </Link>
          </div>
          </div>
        </header>

        <section className="featured-panel surface-panel p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="eyebrow featured-eyebrow">Featured</p>
              <h2 className="mt-3 text-2xl font-semibold">今イチ押し</h2>
            </div>
            <p className="text-sm font-medium text-zinc-500">
              {featuredAnimeList.length} / 3件
            </p>
          </div>

          {featuredAnimeList.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-zinc-600">
              詳細画面から、今いちばん推したい作品を最大3件まで選べます。
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {featuredAnimeList.map((anime) => (
                <Link
                  className={`featured-card rating-${anime.rating}`}
                  href={`/anime/${anime.id}`}
                  key={anime.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="min-w-0 text-base font-semibold leading-6">
                      {anime.title}
                    </h3>
                    <span className={`rating-badge rating-${anime.rating}`}>
                      {anime.rating}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-600">
                    {anime.review || "感想未入力"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        <form
          action="/anime"
          className="surface-panel grid gap-5 p-5"
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_180px_180px_180px]">
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-800">検索</span>
              <input
                className="field-control placeholder:text-zinc-400"
                defaultValue={query}
                name="q"
                placeholder="タイトル、感想、ジャンル"
                type="search"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-800">評価</span>
              <select
                className="field-control"
                defaultValue={isRating(rating) ? rating : ""}
                name="rating"
              >
                <option value="">すべて</option>
                {ratingOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-zinc-800">視聴状況</span>
              <select
                className="field-control"
                defaultValue={isWatchStatus(status) ? status : ""}
                name="status"
              >
                <option value="">すべて</option>
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {statusLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold text-zinc-800">
                ジャンル条件
              </legend>
              <div className="grid min-h-11 grid-cols-2 overflow-hidden rounded-md border border-zinc-300 bg-white text-sm font-semibold shadow-sm">
                <label className="flex items-center justify-center gap-2 border-r border-zinc-200 px-3 py-2 transition has-checked:bg-amber-50 has-checked:text-amber-800">
                  <input
                    className="accent-amber-700"
                    defaultChecked={tagMode === "any"}
                    name="tagMode"
                    type="radio"
                    value="any"
                  />
                  OR
                </label>
                <label className="flex items-center justify-center gap-2 px-3 py-2 transition has-checked:bg-zinc-100 has-checked:text-zinc-900">
                  <input
                    className="accent-amber-700"
                    defaultChecked={tagMode === "all"}
                    name="tagMode"
                    type="radio"
                    value="all"
                  />
                  AND
                </label>
              </div>
            </fieldset>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-zinc-800">
              ジャンル
            </legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {genreOptions.map((genre) => (
                <label
                  className="choice-tile"
                  key={genre}
                >
                  <input
                    className="size-4 accent-amber-700"
                    defaultChecked={selectedGenres.includes(genre)}
                    name="tag"
                    type="checkbox"
                    value={genre}
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </div>
            <p className="text-xs leading-5 text-zinc-500">
              ORは選んだジャンルのどれかに当てはまる作品、ANDは選んだジャンルをすべて含む作品を表示します。
            </p>
          </fieldset>

          <div className="flex flex-wrap gap-3">
            <button
              className="button-primary"
              type="submit"
            >
              絞り込む
            </button>
            {hasFilters ? (
              <Link
                className="button-secondary"
                href="/anime"
              >
                クリア
              </Link>
            ) : null}
          </div>
        </form>

        {animeList.length === 0 ? (
          <div className="surface-panel p-8 text-sm leading-7 text-zinc-600">
            {hasFilters
              ? "条件に一致するアニメがありません。検索条件を変えてみてください。"
              : "まだアニメが登録されていません。まずは見終わった作品や視聴中の作品を1件追加してみましょう。"}
          </div>
        ) : (
          <div className="grid gap-4">
            {animeList.map((anime) => {
              const tagNames = anime.tags.map((animeTag) => animeTag.tag.name);

              return (
                <Link
                  className={`record-card rating-${anime.rating} block p-5`}
                  href={`/anime/${anime.id}`}
                  key={anime.id}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-3">
                      <div>
                        <h2 className="text-xl font-semibold leading-7">
                          {anime.title}
                        </h2>
                        <p className="mt-1 text-xs text-zinc-500">
                          更新: {formatDate(anime.updatedAt)}
                        </p>
                      </div>

                      {anime.review ? (
                        <p className="line-clamp-2 text-sm leading-6 text-zinc-600">
                          {anime.review}
                        </p>
                      ) : (
                        <p className="text-sm text-zinc-400">感想未入力</p>
                      )}

                      {tagNames.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {tagNames.map((tagName) => (
                            <span
                              className="genre-chip"
                              key={tagName}
                            >
                              {tagName}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                      {anime.isFeatured ? (
                        <span className="featured-chip">今イチ押し</span>
                      ) : null}
                      <span className={`rating-badge rating-${anime.rating}`}>
                        {anime.rating}
                      </span>
                      <span className="rounded-md border border-zinc-200 bg-stone-50 px-3 py-1 text-sm font-medium text-zinc-700">
                        {statusLabels[anime.status]}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
