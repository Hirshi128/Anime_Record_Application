import Link from "next/link";
import { ArrowLeft, Search } from "lucide-react";
import { ActionButtonForm } from "@/app/action-button-form";
import { RefreshNotifications } from "./refresh-notifications";

import {
  acceptFriendRequest,
  cancelFriendRequest,
  rejectFriendRequest,
  removeFriend,
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
    page?: string | string[];
    friendPage?: string | string[];
    requestPage?: string | string[];
  }>;
};

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
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
              { displayName: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const pageSize = 30;
  const [totalUsers, totalFriends, totalRequests] = await Promise.all([
    prisma.user.count({ where: userWhere }),
    prisma.friendship.count({ where: { userId: currentUser.id } }),
    prisma.friendRequest.count({ where: { receiverId: currentUser.id, status: FriendRequestStatus.PENDING } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const requestedPage = Number(getParam(params.page));
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? Math.min(requestedPage, totalPages)
      : 1;
  const friendPageSize = 12;
  const totalFriendPages = Math.max(
    1,
    Math.ceil(totalFriends / friendPageSize),
  );
  const requestedFriendPage = Number(getParam(params.friendPage));
  const friendPage =
    Number.isSafeInteger(requestedFriendPage) && requestedFriendPage > 0
      ? Math.min(requestedFriendPage, totalFriendPages)
      : 1;
  const requestPageSize = 12;
  const totalRequestPages = Math.max(1, Math.ceil(totalRequests / requestPageSize));
  const requestedRequestPage = Number(getParam(params.requestPage));
  const requestPage = Number.isSafeInteger(requestedRequestPage) && requestedRequestPage > 0
    ? Math.min(requestedRequestPage, totalRequestPages) : 1;
  function pageHref(
    nextPage: number,
    nextFriendPage = friendPage,
    fragment = "user-results",
    nextRequestPage = requestPage,
  ) {
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (nextPage > 1) search.set("page", String(nextPage));
    if (nextFriendPage > 1) search.set("friendPage", String(nextFriendPage));
    if (nextRequestPage > 1) search.set("requestPage", String(nextRequestPage));
    return `/users/search${search.size ? `?${search}` : ""}#${fragment}`;
  }

  const users = await prisma.user.findMany({
    where: userWhere,
    include: {
      favoriteGenres: { orderBy: { name: "asc" } },
      anime: {
        where: { isFeatured: true },
        orderBy: [{ featuredAt: "desc" }, { updatedAt: "desc" }],
        take: 3,
      },
    },
    orderBy: [{ displayName: "asc" }, { username: "asc" }],
    take: pageSize,
    skip: (page - 1) * pageSize,
  });
  const visibleUserIds = users.map((user) => user.id);
  const [
    receivedRequests,
    visibleIncomingRequests,
    sentPendingRequests,
    friendships,
    friendRows,
  ] = await Promise.all([
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
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: requestPageSize,
      skip: (requestPage - 1) * requestPageSize,
    }),
    prisma.friendRequest.findMany({
      where: { receiverId: currentUser.id, senderId: { in: visibleUserIds }, status: FriendRequestStatus.PENDING },
      select: { id: true, senderId: true },
    }),
    prisma.friendRequest.findMany({
      where: {
        senderId: currentUser.id,
        receiverId: { in: visibleUserIds },
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
        friendId: { in: visibleUserIds },
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
      orderBy: [{ createdAt: "desc" }, { friendId: "asc" }],
      take: friendPageSize,
      skip: (friendPage - 1) * friendPageSize,
    }),
  ]);

  const friendIds = new Set(
    friendships.map((friendship) => friendship.friendId),
  );
  const sentPendingByReceiverId = new Map(
    sentPendingRequests.map((request) => [request.receiverId, request.id]),
  );
  const receivedPendingBySenderId = new Map(
    visibleIncomingRequests.map((request) => [request.senderId, request.id]),
  );

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-6xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="mb-5">
                <Link className="button-secondary" href="/anime">
                  <ArrowLeft aria-hidden="true" size={18} />アニメ一覧へ戻る
                </Link>
              </div>
              <p className="eyebrow">Friends</p>
              <h1 className="mt-3 text-3xl font-semibold">
                ユーザー検索
              </h1>
            </div>
            <Link className="button-secondary w-fit" href="/users/profile">
              プロフィール登録
            </Link>
          </div>
        </header>

        <section id="friend-requests" className="surface-panel p-5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-xl font-semibold">フレンド申請</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="notification-badge">{totalRequests}件</span>
              <RefreshNotifications />
            </div>
          </div>

          {receivedRequests.length === 0 ? (
            <p className="mt-5 text-sm leading-6 text-zinc-600">
              新しいフレンド申請はありません。
            </p>
          ) : (
            <div className="mt-5 grid gap-3">
              {receivedRequests.map((request) => {
                const acceptAction = acceptFriendRequest.bind(
                  null,
                  String(request.id),
                );
                const rejectAction = rejectFriendRequest.bind(
                  null,
                  String(request.id),
                );

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
                      <FavoriteGenreList
                        genres={request.sender.favoriteGenres}
                      />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      <ActionButtonForm
                        returnTo={pageHref(page, friendPage, "friend-requests")}
                        action={acceptAction}
                        label="承認"
                        pendingLabel="承認中..."
                      />
                      <ActionButtonForm
                        returnTo={pageHref(page, friendPage, "friend-requests")}
                        action={rejectAction}
                        label="見送る"
                        className="button-secondary"
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {totalRequestPages > 1 ? (
            <nav className="mt-5 flex flex-wrap items-center justify-between gap-3" aria-label="フレンド申請のページ">
              {requestPage > 1 ? <Link className="button-secondary" href={pageHref(page, friendPage, "friend-requests", requestPage - 1)}>← 前のページ</Link> : <span />}
              <span className="text-sm text-zinc-600">{requestPage} / {totalRequestPages} ページ</span>
              {requestPage < totalRequestPages ? <Link className="button-secondary" href={pageHref(page, friendPage, "friend-requests", requestPage + 1)}>次のページ →</Link> : <span />}
            </nav>
          ) : null}
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
            <button className="button-primary button-large" type="submit">
              <Search aria-hidden="true" size={20} />
              検索
            </button>
            {query ? (
              <Link className="button-secondary" href="/users/search">
                クリア
              </Link>
            ) : null}
          </div>
        </form>

        <section id="user-results" className="grid gap-4">
          <h2 className="text-lg font-semibold">ユーザー {totalUsers} 人</h2>
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
                      <h2 className="text-xl font-semibold">
                        {user.displayName}
                      </h2>
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
                      <>
                        <span className="friend-state-chip">フレンド</span>
                        <ActionButtonForm returnTo={pageHref(page)} action={removeFriend.bind(null, String(user.id))} label="フレンド解除" pendingLabel="解除中..." className="button-secondary" confirmation={`${user.displayName}さんとのフレンド関係を解除しますか？`} />
                      </>
                    ) : receivedRequestId && acceptAction && rejectAction ? (
                      <>
                        <ActionButtonForm
                          returnTo={pageHref(page)}
                          action={acceptAction}
                          label="承認"
                          pendingLabel="承認中..."
                        />
                        <ActionButtonForm
                          returnTo={pageHref(page)}
                          action={rejectAction}
                          label="見送る"
                          className="button-secondary"
                        />
                      </>
                    ) : sentRequestId ? (
                      <>
                        <span className="pending-state-chip">申請中</span>
                        <ActionButtonForm
                          returnTo={pageHref(page)}
                          action={cancelFriendRequest.bind(
                            null,
                            String(sentRequestId),
                          )}
                          label="申請を取り消す"
                          className="button-secondary"
                        />
                      </>
                    ) : (
                      <ActionButtonForm
                        returnTo={pageHref(page)}
                        action={sendAction}
                        label="フレンド申請"
                        pendingLabel="申請中..."
                      />
                    )}
                  </div>
                </article>
              );
            })
          )}
        </section>

        {totalPages > 1 ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label="ユーザー検索のページ"
          >
            {page > 1 ? (
              <Link className="button-secondary" href={pageHref(page - 1)}>
                ← 前のページ
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm text-zinc-600">
              {page} / {totalPages} ページ
            </span>
            {page < totalPages ? (
              <Link className="button-secondary" href={pageHref(page + 1)}>
                次のページ →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}

        {friendRows.length > 0 ? (
          <section id="friends" className="surface-panel p-5">
            <h2 className="text-xl font-semibold">
              フレンド {totalFriends} 人
            </h2>
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
                  <ActionButtonForm returnTo={pageHref(page, friendPage, "friends")} action={removeFriend.bind(null, String(row.friendId))} label="フレンド解除" pendingLabel="解除中..." className="button-secondary" confirmation={`${row.friend.displayName}さんとのフレンド関係を解除しますか？`} />
                </article>
              ))}
            </div>
            {totalFriendPages > 1 ? (
              <nav
                className="mt-5 flex flex-wrap items-center justify-between gap-3"
                aria-label="フレンド一覧のページ"
              >
                {friendPage > 1 ? (
                  <Link
                    className="button-secondary"
                    href={pageHref(page, friendPage - 1, "friends")}
                  >
                    ← 前のページ
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-sm text-zinc-600">
                  {friendPage} / {totalFriendPages} ページ
                </span>
                {friendPage < totalFriendPages ? (
                  <Link
                    className="button-secondary"
                    href={pageHref(page, friendPage + 1, "friends")}
                  >
                    次のページ →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </section>
        ) : null}
      </section>
    </main>
  );
}
