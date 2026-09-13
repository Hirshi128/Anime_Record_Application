import Link from "next/link";

import { updateUserProfile } from "../actions";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/current-user";
import { genreOptions, statusLabels } from "@/lib/anime-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UserProfilePage() {
  const currentUser = await requireCurrentUser();
  const [user, animeList, pendingFriendRequestCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: currentUser.id },
      include: {
        favoriteGenres: {
          orderBy: {
            name: "asc",
          },
        },
      },
    }),
    prisma.anime.findMany({
      where: {
        userId: currentUser.id,
      },
      orderBy: [
        {
          isFeatured: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    }),
    prisma.friendRequest.count({
      where: {
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
    }),
  ]);

  if (!user) {
    return null;
  }

  const selectedFavoriteGenres = user.favoriteGenres.map((genre) => genre.name);
  const featuredAnimeIds = animeList
    .filter((anime) => anime.isFeatured)
    .map((anime) => anime.id);

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-5xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content space-y-6">
            <Link className="button-secondary" href="/users">
              ← ユーザー選択へ戻る
            </Link>
            <div>
              <p className="eyebrow">Profile</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                ユーザー情報登録
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
                フレンド機能で見せるプロフィールの土台です。好きな作品やジャンルが分かるように整えておきます。
              </p>
            </div>
          </div>
        </header>

        <form action={updateUserProfile} className="space-y-6">
          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">基本情報</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-800">
                  表示名
                </span>
                <input
                  className="field-control"
                  defaultValue={user.displayName}
                  name="displayName"
                  placeholder="例: hirsh"
                  required
                  type="text"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-800">
                  ユーザーID
                </span>
                <input
                  className="field-control"
                  defaultValue={user.username}
                  name="username"
                  pattern="[A-Za-z0-9_]{3,}"
                  placeholder="例: hirsh_anime"
                  required
                  type="text"
                />
              </label>
            </div>
          </section>

          <section className="surface-panel p-5">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <h2 className="text-xl font-semibold">イチ押しアニメ</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  自分の記録から最大3件まで選べます。
                </p>
              </div>
              <Link className="button-secondary w-fit" href="/anime/new">
                アニメを追加
              </Link>
            </div>

            {animeList.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-zinc-600">
                まだアニメ記録がありません。先に作品を登録すると、ここでイチ押しに選べます。
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {animeList.map((anime) => (
                  <label className="profile-anime-choice" key={anime.id}>
                    <input
                      className="size-4 accent-amber-700"
                      defaultChecked={featuredAnimeIds.includes(anime.id)}
                      name="featuredAnimeIds"
                      type="checkbox"
                      value={anime.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{anime.title}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        評価 {anime.rating} / {statusLabels[anime.status]}
                      </span>
                    </span>
                    {anime.isFeatured ? (
                      <span className="featured-chip">選択中</span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">好きなジャンル</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              フレンドに好みが伝わりやすいジャンルを選びます。
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {genreOptions.map((genre) => (
                <label className="choice-tile" key={genre}>
                  <input
                    className="size-4 accent-amber-700"
                    defaultChecked={selectedFavoriteGenres.includes(genre)}
                    name="favoriteGenres"
                    type="checkbox"
                    value={genre}
                  />
                  <span>{genre}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex flex-wrap gap-3">
            <button className="button-primary" type="submit">
              プロフィールを保存
            </button>
            <Link
              className="button-secondary button-with-notification"
              href="/users/search"
            >
              フレンド検索へ
              {pendingFriendRequestCount > 0 ? (
                <span aria-hidden="true" className="friend-alert-mark">
                  !
                </span>
              ) : null}
            </Link>
            <Link className="button-secondary" href="/anime">
              アニメ一覧へ
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
