import Link from "next/link";
import { ArrowLeft, KeyRound } from "lucide-react";
import { FriendRequestStatus } from "@/generated/prisma/enums";
import { requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "./profile-form";
import { usesCredentialAuth } from "@/lib/auth-mode";

export const dynamic = "force-dynamic";

export default async function UserProfilePage() {
  const currentUser = await requireCurrentUser();
  const [user, animeList, pendingFriendRequestCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: currentUser.id },
      include: { favoriteGenres: { orderBy: { name: "asc" } } },
    }),
    prisma.anime.findMany({
      where: { userId: currentUser.id },
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        rating: true,
        status: true,
        isFeatured: true,
      },
    }),
    prisma.friendRequest.count({
      where: {
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
    }),
  ]);
  if (!user) return null;

  return (
    <main className="app-page text-zinc-950">
      <section className="page-shell max-w-5xl space-y-8">
        <header className="record-hero">
          <div className="record-hero-content space-y-6">
            <Link className="button-secondary" href="/users">
              <ArrowLeft aria-hidden="true" size={18} />{usesCredentialAuth() ? "アカウントへ戻る" : "ユーザー選択へ戻る"}
            </Link>
            <div>
              <p className="eyebrow">Profile</p>
              <h1 className="mt-3 text-3xl font-semibold">
                ユーザー情報登録
              </h1>
              <p className="mt-3 text-sm text-zinc-600">
                {user.displayName} / @{user.username}
              </p>
            </div>
          </div>
        </header>
        {usesCredentialAuth() ? <Link className="button-secondary" href="/users/account"><KeyRound aria-hidden="true" size={18} />パスワード変更</Link> : null}
        <ProfileForm
          key={currentUser.id}
          user={user}
          animeList={animeList}
          pendingFriendRequestCount={pendingFriendRequestCount}
        />
      </section>
    </main>
  );
}
