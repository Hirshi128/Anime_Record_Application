import Link from "next/link";

import { createUser, loginUser } from "./actions";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [currentUser, users] = await Promise.all([
    getCurrentUser(),
    prisma.user.findMany({
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  const pendingFriendRequestCount = currentUser
    ? await prisma.friendRequest.count({
        where: {
          receiverId: currentUser.id,
          status: FriendRequestStatus.PENDING,
        },
      })
    : 0;

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-5xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content space-y-6">
            <Link className="button-secondary" href="/">
              ← ホームへ戻る
            </Link>
            <div>
              <p className="eyebrow">Users</p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
                ユーザーを選択
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/78">
                ローカルMVP用のユーザー機能です。ユーザーごとにアニメ記録を分けて管理できます。
              </p>
            </div>
          </div>
        </header>

        {currentUser ? (
          <section className="surface-panel p-5">
            <p className="text-sm font-semibold text-zinc-500">
              現在のユーザー
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  {currentUser.displayName}
                </h2>
                <p className="text-sm text-zinc-600">@{currentUser.username}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link className="button-secondary w-fit" href="/users/profile">
                  プロフィール登録
                </Link>
                <Link className="button-secondary button-with-notification w-fit" href="/users/search">
                  {pendingFriendRequestCount > 0 ? (
                    <span aria-hidden="true" className="friend-alert-mark">
                      !
                    </span>
                  ) : null}
                  フレンド検索
                </Link>
              <Link className="button-primary w-fit" href="/anime">
                このユーザーで続ける
              </Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">新しいユーザーを作成</h2>
            <form action={createUser} className="mt-5 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-zinc-800">
                  表示名
                </span>
                <input
                  className="field-control"
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
                  name="username"
                  pattern="[A-Za-z0-9_]{3,}"
                  placeholder="例: hirsh_anime"
                  required
                  type="text"
                />
              </label>
              <button className="button-primary" type="submit">
                作成してログイン
              </button>
            </form>
          </section>

          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">既存ユーザーでログイン</h2>
            {users.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-zinc-600">
                まだユーザーがありません。左のフォームから最初のユーザーを作成してください。
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {users.map((user) => (
                  <form
                    action={loginUser}
                    className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3"
                    key={user.id}
                  >
                    <input name="userId" type="hidden" value={user.id} />
                    <div>
                      <p className="font-semibold">{user.displayName}</p>
                      <p className="text-sm text-zinc-600">@{user.username}</p>
                    </div>
                    <button className="button-secondary" type="submit">
                      ログイン
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
