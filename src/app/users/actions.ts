"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { FriendRequestStatus } from "@/generated/prisma/enums";
import { isGenre } from "@/lib/anime-options";
import { currentUserCookieName, requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUsername(username: string) {
  return username.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

function parseFavoriteGenres(formData: FormData) {
  const seen = new Set<string>();

  return formData
    .getAll("favoriteGenres")
    .map((genre) => (typeof genre === "string" ? genre.trim() : ""))
    .filter((genre) => {
      if (!isGenre(genre)) {
        return false;
      }

      if (seen.has(genre)) {
        return false;
      }

      seen.add(genre);
      return true;
    });
}

function parseFeaturedAnimeIds(formData: FormData) {
  const seen = new Set<number>();

  return formData
    .getAll("featuredAnimeIds")
    .map((id) => Number(id))
    .filter((id) => {
      if (!Number.isInteger(id) || id <= 0 || seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
}

function parsePositiveId(id: string) {
  const parsedId = Number(id);

  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw new Error("IDが不正です。");
  }

  return parsedId;
}

function revalidateUserSocialPages() {
  revalidatePath("/");
  revalidatePath("/anime");
  revalidatePath("/users");
  revalidatePath("/users/profile");
  revalidatePath("/users/search");
}

async function setCurrentUserCookie(userId: number) {
  const cookieStore = await cookies();

  cookieStore.set({
    name: currentUserCookieName,
    value: String(userId),
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createUser(formData: FormData) {
  const displayName = getString(formData, "displayName");
  const username = normalizeUsername(getString(formData, "username"));

  if (!displayName) {
    throw new Error("表示名は必須です。");
  }

  if (username.length < 3) {
    throw new Error("ユーザーIDは3文字以上の英数字と_で入力してください。");
  }

  const existingUserCount = await prisma.user.count();
  const user = await prisma.user.create({
    data: {
      displayName,
      username,
    },
    select: { id: true },
  });

  if (existingUserCount === 0) {
    await prisma.anime.updateMany({
      where: { userId: null },
      data: { userId: user.id },
    });
  }

  await setCurrentUserCookie(user.id);
  revalidatePath("/");
  revalidatePath("/anime");
  redirect("/anime");
}

export async function loginUser(formData: FormData) {
  const userId = Number(getString(formData, "userId"));

  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error("ユーザーを選択してください。");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("ユーザーが見つかりません。");
  }

  await setCurrentUserCookie(user.id);
  revalidatePath("/");
  revalidatePath("/anime");
  redirect("/anime");
}

export async function logoutUser() {
  const cookieStore = await cookies();

  cookieStore.delete(currentUserCookieName);
  revalidatePath("/");
  revalidatePath("/anime");
  redirect("/users");
}

export async function updateUserProfile(formData: FormData) {
  const currentUser = await requireCurrentUser();
  const displayName = getString(formData, "displayName");
  const username = normalizeUsername(getString(formData, "username"));
  const favoriteGenres = parseFavoriteGenres(formData);
  const featuredAnimeIds = parseFeaturedAnimeIds(formData);

  if (!displayName) {
    throw new Error("表示名は必須です。");
  }

  if (username.length < 3) {
    throw new Error("ユーザーIDは3文字以上の英数字と_で入力してください。");
  }

  if (featuredAnimeIds.length > 3) {
    throw new Error("イチ押しアニメは3件まで選べます。");
  }

  const sameUsernameUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (sameUsernameUser && sameUsernameUser.id !== currentUser.id) {
    throw new Error("このユーザーIDはすでに使われています。");
  }

  await prisma.$transaction(async (tx) => {
    const ownedFeaturedAnime = await tx.anime.findMany({
      where: {
        id: {
          in: featuredAnimeIds,
        },
        userId: currentUser.id,
      },
      select: {
        id: true,
      },
    });
    const ownedFeaturedAnimeIds = new Set(
      ownedFeaturedAnime.map((anime) => anime.id),
    );

    if (ownedFeaturedAnimeIds.size !== featuredAnimeIds.length) {
      throw new Error("選択できないアニメが含まれています。");
    }

    await tx.user.update({
      where: { id: currentUser.id },
      data: {
        displayName,
        username,
        favoriteGenres: {
          deleteMany: {},
          create: favoriteGenres.map((name) => ({ name })),
        },
      },
    });

    await tx.anime.updateMany({
      where: {
        userId: currentUser.id,
      },
      data: {
        isFeatured: false,
        featuredAt: null,
      },
    });

    if (featuredAnimeIds.length > 0) {
      await tx.anime.updateMany({
        where: {
          userId: currentUser.id,
          id: {
            in: featuredAnimeIds,
          },
        },
        data: {
          isFeatured: true,
          featuredAt: new Date(),
        },
      });
    }
  });

  revalidatePath("/");
  revalidatePath("/anime");
  revalidatePath("/users");
  revalidatePath("/users/profile");
  redirect("/users/profile");
}

export async function sendFriendRequest(receiverIdValue: string) {
  const currentUser = await requireCurrentUser();
  const receiverId = parsePositiveId(receiverIdValue);

  if (receiverId === currentUser.id) {
    throw new Error("自分自身にはフレンド申請できません。");
  }

  await prisma.$transaction(async (tx) => {
    const [receiver, friendship] = await Promise.all([
      tx.user.findUnique({
        where: { id: receiverId },
        select: { id: true },
      }),
      tx.friendship.findUnique({
        where: {
          userId_friendId: {
            userId: currentUser.id,
            friendId: receiverId,
          },
        },
        select: { userId: true },
      }),
    ]);

    if (!receiver) {
      throw new Error("申請先のユーザーが見つかりません。");
    }

    if (friendship) {
      throw new Error("すでにフレンドです。");
    }

    await tx.friendRequest.upsert({
      where: {
        senderId_receiverId: {
          senderId: currentUser.id,
          receiverId,
        },
      },
      create: {
        senderId: currentUser.id,
        receiverId,
      },
      update: {
        status: FriendRequestStatus.PENDING,
      },
    });
  });

  revalidateUserSocialPages();
  redirect("/users/search");
}

export async function acceptFriendRequest(requestIdValue: string) {
  const currentUser = await requireCurrentUser();
  const requestId = parsePositiveId(requestIdValue);

  await prisma.$transaction(async (tx) => {
    const request = await tx.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
      },
    });

    if (!request) {
      throw new Error("承認できるフレンド申請が見つかりません。");
    }

    await tx.friendRequest.update({
      where: { id: request.id },
      data: {
        status: FriendRequestStatus.ACCEPTED,
      },
    });

    await tx.friendship.upsert({
      where: {
        userId_friendId: {
          userId: request.receiverId,
          friendId: request.senderId,
        },
      },
      create: {
        userId: request.receiverId,
        friendId: request.senderId,
      },
      update: {},
    });

    await tx.friendship.upsert({
      where: {
        userId_friendId: {
          userId: request.senderId,
          friendId: request.receiverId,
        },
      },
      create: {
        userId: request.senderId,
        friendId: request.receiverId,
      },
      update: {},
    });
  });

  revalidateUserSocialPages();
  redirect("/users/search");
}

export async function rejectFriendRequest(requestIdValue: string) {
  const currentUser = await requireCurrentUser();
  const requestId = parsePositiveId(requestIdValue);

  await prisma.friendRequest.updateMany({
    where: {
      id: requestId,
      receiverId: currentUser.id,
      status: FriendRequestStatus.PENDING,
    },
    data: {
      status: FriendRequestStatus.REJECTED,
    },
  });

  revalidateUserSocialPages();
  redirect("/users/search");
}
