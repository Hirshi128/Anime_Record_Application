import Link from "next/link";

import {
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
} from "../actions";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type UserSearchPageProps = {
  searchParams: Promise<{
    q?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function FeaturedAnimeList({
  anime,
}: {
  anime: { id: number; title: string; rating: string }[];
}) {
  if (anime.length === 0) {
    return <p className="text-sm text-zinc-500">イチ押し未登録</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {anime.map((item) => (
        <span className={`rating-mini rating-${item.rating}`} key={item.id}>
          {item.title}
        </span>
      ))}
    </div>
  );
}

function FavoriteGenreList({ genres }: { genres: { name: string }[] }) {
  if (genres.length === 0) {
    return <p className="text-sm text-zinc-500">好きなジャンル未登録</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {genres.map((genre) => (
        <span className="genre-chip" key={genre.name}>
          {genre.name}
        </span>
      ))}
    </div>
  );
}

export default async function UserSearchPage({
  searchParams,
}: UserSearchPageProps) {
  const params = await searchParams;
  const query = getParam(params.q).trim();
  const currentUser = await requireCurrentUser();

  const userWhere: Prisma.UserWhereInput = {
    AND: [
      {
        id: {
          not: currentUser.id,
        },
      },
      query
        ? {
            OR: [
              { displayName: { contains: query } },
              { username: { contains: query } },
            ],
          }
        : {},
    ],
  };

  const [
    users,
    receivedRequests,
    sentPendingRequests,
    friendships,
    friendRows,
  ] = await Promise.all([
    prisma.user.findMany({
      where: userWhere,
      include: {
        favoriteGenres: {
          orderBy: { name: "asc" },
        },
        anime: {
          where: { isFeatured: true },
          orderBy: [{ featuredAt: "desc" }, { updatedAt: "desc" }],
          take: 3,
        },
      },
      orderBy: [{ displayName: "asc" }, { username: "asc" }],
      take: 30,
    }),
    prisma.friendRequest.findMany({
      where: {
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      include: {
        sender: {
          include: {
            favoriteGenres: {
              orderBy: { name: "asc" },
            },
            anime: {
              where: { isFeatured: true },
              orderBy: [{ featuredAt: "desc" }, { updatedAt: "desc" }],
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.friendRequest.findMany({
      where: {
        senderId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      select: {
        id: true,
        receiverId: true,
      },
    }),
    prisma.friendship.findMany({
      where: {
        userId: currentUser.id,
      },
      select: {
        friendId: true,
      },
    }),
    prisma.friendship.findMany({
      where: {
        userId: currentUser.id,
      },
      include: {
        friend: {
          include: {
            favoriteGenres: {
              orderBy: { name: "asc" },
            },
            anime: {
              where: { isFeatured: true },
              orderBy: [{ featuredAt: "desc" }, { updatedAt: "desc" }],
              take: 3,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  const friendIds = new Set(friendships.map((friendship) => friendship.friendId));
  const sentPendingByReceiverId = new Map(
    sentPendingRequests.map((request) => [request.receiverId, request.id]),
  );
  const receivedPendingBySenderId = new Map(
    receivedRequests.map((request) => [request.senderId, request.id]),
  );

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-6xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <Link className="button-secondary mb-5" href="/anime">
                ← アニメ一覧へ戻る
              </Link>
              <p className="eyebrow">Friends</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                ユーザー検索
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
                気になるユーザーを探して、イチ押しアニメや好きなジャンルを見ながらフレンド申請できます。
              </p>
            </div>
            <Link className="button-secondary w-fit" href="/users/profile">
              プロフィール登録
            </Link>
          </div>
        </header>

        <section className="surface-panel p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold">通知</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                受け取ったフレンド申請がここに表示されます。
              </p>
            </div>
            <span className="notification-badge">{receivedRequests.length}件</span>
          </div>

          {receivedRequests.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-zinc-600">
              新しいフレンド申請はありません。
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {receivedRequests.map((request) => {
                const acceptAction = acceptFriendRequest.bind(null, String(request.id));
                const rejectAction = rejectFriendRequest.bind(null, String(request.id));

                return (
                  <article className="user-card" key={request.id}>
                    <div className="min-w-0 space-y-3">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {request.sender.displayName}
                        </h3>
                        <p className="text-sm text-zinc-500">
                          @{request.sender.username}
                        </p>
                      </div>
                      <FeaturedAnimeList anime={request.sender.anime} />
                      <FavoriteGenreList genres={request.sender.favoriteGenres} />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <form action={acceptAction}>
                        <button className="button-primary" type="submit">
                          承認
                        </button>
                      </form>
                      <form action={rejectAction}>
                        <button className="button-secondary" type="submit">
                          見送る
                        </button>
                      </form>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <form action="/users/search" className="surface-panel p-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-zinc-800">
              ユーザー検索
            </span>
            <input
              className="field-control"
              defaultValue={query}
              name="q"
              placeholder="ユーザー名、ユーザーID"
              type="search"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button className="button-primary" type="submit">
              検索
            </button>
            {query ? (
              <Link className="button-secondary" href="/users/search">
                クリア
              </Link>
            ) : null}
          </div>
        </form>

        <section className="grid gap-4">
          {users.length === 0 ? (
            <div className="surface-panel p-6 text-sm leading-6 text-zinc-600">
              条件に合うユーザーが見つかりませんでした。
            </div>
          ) : (
            users.map((user) => {
              const isFriend = friendIds.has(user.id);
              const sentRequestId = sentPendingByReceiverId.get(user.id);
              const receivedRequestId = receivedPendingBySenderId.get(user.id);
              const sendAction = sendFriendRequest.bind(null, String(user.id));
              const acceptAction = receivedRequestId
                ? acceptFriendRequest.bind(null, String(receivedRequestId))
                : null;
              const rejectAction = receivedRequestId
                ? rejectFriendRequest.bind(null, String(receivedRequestId))
                : null;

              return (
                <article className="user-card" key={user.id}>
                  <div className="min-w-0 space-y-4">
                    <div>
                      <h2 className="text-xl font-semibold">{user.displayName}</h2>
                      <p className="text-sm text-zinc-500">@{user.username}</p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase text-zinc-500">
                          イチ押し
                        </p>
                        <FeaturedAnimeList anime={user.anime} />
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase text-zinc-500">
                          好きなジャンル
                        </p>
                        <FavoriteGenreList genres={user.favoriteGenres} />
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {isFriend ? (
                      <span className="friend-state-chip">フレンド</span>
                    ) : receivedRequestId && acceptAction && rejectAction ? (
                      <>
                        <form action={acceptAction}>
                          <button className="button-primary" type="submit">
                            承認
                          </button>
                        </form>
                        <form action={rejectAction}>
                          <button className="button-secondary" type="submit">
                            見送る
                          </button>
                        </form>
                      </>
                    ) : sentRequestId ? (
                      <span className="pending-state-chip">申請中</span>
                    ) : (
                      <form action={sendAction}>
                        <button className="button-primary" type="submit">
                          フレンド申請
                        </button>
                      </form>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {friendRows.length > 0 ? (
          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">フレンド</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {friendRows.map((row) => (
                <article className="friend-mini-card" key={row.friendId}>
                  <div>
                    <h3 className="font-semibold">{row.friend.displayName}</h3>
                    <p className="text-sm text-zinc-500">
                      @{row.friend.username}
                    </p>
                  </div>
                  <FeaturedAnimeList anime={row.friend.anime} />
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
