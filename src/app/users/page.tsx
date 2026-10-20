import Link from "next/link";
import { ArrowLeft, ArrowRight, UsersRound } from "lucide-react";

import { loginUser } from "./actions";
import { UserRegistrationForm } from "./user-registration-form";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { usesCredentialAuth } from "@/lib/auth-mode";
import { CredentialsPage } from "./credentials-page";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ logout?: string | string[] }> } = {}) {
  if (usesCredentialAuth()) return <CredentialsPage user={await getCurrentUser()} logoutWarning={(await searchParams)?.logout === "partial"} />;
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
              <ArrowLeft aria-hidden="true" size={18} />ホームへ戻る
            </Link>
            <div>
              <p className="eyebrow">Users</p>
              <h1 className="mt-3 text-3xl font-semibold">
                ユーザーを選択
              </h1>
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
                    <>
                      <span aria-hidden="true" className="friend-alert-mark">!</span>
                      <span className="sr-only">未対応のフレンド申請 {pendingFriendRequestCount} 件</span>
                    </>
                  ) : null}
                  フレンド検索
                </Link>
              <Link className="button-primary button-large" href="/anime">
                このユーザーで続ける<ArrowRight aria-hidden="true" size={20} />
              </Link>
              </div>
            </div>
          </section>
        ) : null}

        <div className="grid items-start gap-8 lg:grid-cols-2">
          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">既存ユーザーでログイン</h2>
            {users.length === 0 ? (
              <p className="mt-5 text-sm leading-6 text-zinc-600">
                まだユーザーがありません。新しいユーザーを作成してください。
              </p>
            ) : (
              <div className="mt-5 grid gap-3">
                {users.map((user) => (
                  <form
                    action={loginUser}
                    className="user-login-row"
                    key={user.id}
                  >
                    <input name="userId" type="hidden" value={user.id} />
                    <div className="min-w-0">
                      <p className="font-semibold">{user.displayName}</p>
                      <p className="text-sm text-zinc-600">@{user.username}</p>
                    </div>
                    <button className="button-primary button-large shrink-0" type="submit">
                      <UsersRound aria-hidden="true" size={20} />ログイン
                    </button>
                  </form>
                ))}
              </div>
            )}
          </section>
          <section className="surface-panel p-5">
            <h2 className="text-xl font-semibold">新しいユーザーを作成</h2>
            <UserRegistrationForm />
          </section>
        </div>
      </section>
    </main>
  );
}
