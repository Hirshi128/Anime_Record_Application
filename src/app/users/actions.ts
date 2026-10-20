"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { FriendRequestStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import {
  parseProfileChoices,
  parseUserBasics,
  isUniqueConstraintError,
} from "@/lib/user-form-data";
import type { FormState } from "@/lib/form-state";
import { currentUserCookieName, requireCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { lockUsers } from "@/lib/transaction-locks";
import { parseRecordId } from "@/lib/record-id";
import { requireDemoMode, usesCredentialAuth } from "@/lib/auth-mode";
import { allowAuthAttempt, clearSession } from "@/lib/auth-session";
import { socialReturnPath } from "@/lib/social-return-path";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function socialTransaction(operation: (tx: Prisma.TransactionClient) => Promise<FormState | null | void>) {
  try { return await prisma.$transaction(operation); }
  catch {
    return { message: "操作を確認できませんでした。ページを更新して結果を確認してください。" };
  }
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
    secure: process.env.VERCEL === "1",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createUser(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  requireDemoMode();
  const parsed = parseUserBasics(formData);
  if (parsed.error) return { message: parsed.error };
  const { displayName, username } = parsed.data;
  const existingUser = await prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (existingUser)
    return {
      message:
        "このユーザーIDはすでに使われています。別のIDを入力してください。",
    };

  const existingUserCount = await prisma.user.count();
  let user;
  try {
    user = await prisma.user.create({
      data: {
        displayName,
        username,
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error))
      return {
        message:
          "このユーザーIDはすでに使われています。別のIDを入力してください。",
      };
    throw error;
  }

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
  requireDemoMode();
  const userId = parseRecordId(getString(formData, "userId"));

  if (userId === null) {
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

export async function logoutUser(): Promise<never> {
  let revocationFailed = false;
  if (usesCredentialAuth()) {
    try { await clearSession(); }
    catch { revocationFailed = true; }
  }
  const cookieStore = await cookies();

  cookieStore.delete(currentUserCookieName);
  revalidatePath("/");
  revalidatePath("/anime");
  return redirect(revocationFailed ? "/users?logout=partial" : "/users");
}

export async function updateUserProfile(
  _state: FormState,
  formData: FormData,
): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const basics = parseUserBasics(formData);
  if (basics.error) return { message: basics.error };
  const choices = parseProfileChoices(formData);
  if (choices.error) return { message: choices.error };
  const { displayName, username } = basics.data;
  const { favoriteGenres, featuredAnimeIds } = choices.data;

  try {
    const sameUsernameUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (sameUsernameUser && sameUsernameUser.id !== currentUser.id) {
      return { message: "このユーザーIDはすでに使われています。" };
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockUsers(tx, currentUser.id);
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
        return {
          message:
            "選択できないアニメが含まれています。ページを更新して確認してください。",
        };
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
      return null;
    });
    if (result) return result;
  } catch (error) {
    if (isUniqueConstraintError(error))
      return { message: "このユーザーIDはすでに使われています。" };
    return { message: "プロフィールの保存結果を確認できませんでした。入力内容を確認し、時間をおいて再度お試しください。" };
  }

  revalidateUserSocialPages();
  redirect("/users/profile");
}

export async function sendFriendRequest(
  receiverIdValue: string,
  _state?: FormState,
  formData?: FormData,
): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const receiverId = parseRecordId(receiverIdValue);
  if (receiverId === null) return { message: "ユーザーIDが不正です。ページを更新してください。" };

  if (receiverId === currentUser.id) {
    return { message: "自分自身にはフレンド申請できません。" };
  }

  if (usesCredentialAuth()) {
    try {
      if (!await allowAuthAttempt(String(currentUser.id), "friend-request", 10)) {
        return { message: "フレンド申請が続いています。15分ほど待ってからお試しください。" };
      }
    } catch {
      return { message: "申請を確認できませんでした。ページを更新してからお試しください。" };
    }
  }

  const result = await socialTransaction(async (tx) => {
    await lockUsers(tx, currentUser.id, receiverId);
    const [receiver, friendship, incomingRequest, outgoingRequest] =
      await Promise.all([
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
        tx.friendRequest.findFirst({
          where: {
            senderId: receiverId,
            receiverId: currentUser.id,
            status: FriendRequestStatus.PENDING,
          },
          select: { id: true },
        }),
        tx.friendRequest.findUnique({
          where: {
            senderId_receiverId: { senderId: currentUser.id, receiverId },
          },
          select: { status: true },
        }),
      ]);

    if (!receiver) {
      return { message: "申請先のユーザーが見つかりません。" };
    }

    if (friendship) {
      return null;
    }

    if (incomingRequest)
      return {
        message:
          "このユーザーから申請が届いています。通知から承認してください。",
      };
    if (outgoingRequest?.status === FriendRequestStatus.PENDING) return null;

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
    return null;
  });

  if (result) return result;

  revalidateUserSocialPages();
  redirect(socialReturnPath(formData));
}

export async function acceptFriendRequest(
  requestIdValue: string,
  _state?: FormState,
  formData?: FormData,
): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const requestId = parseRecordId(requestIdValue);
  if (requestId === null) return { message: "申請IDが不正です。通知を更新してください。" };

  const result = await socialTransaction(async (tx) => {
    const request = await tx.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: currentUser.id,
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        status: true,
      },
    });

    if (!request) {
      return {
        message:
          "承認できるフレンド申請が見つかりません。通知を更新してください。",
      };
    }
    if (request.status === FriendRequestStatus.ACCEPTED) return null;
    if (request.status !== FriendRequestStatus.PENDING)
      return { message: "この申請はすでに見送り済みです。" };
    await lockUsers(tx, request.senderId, request.receiverId);

    const claimed = await tx.friendRequest.updateMany({
      where: {
        id: request.id,
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      data: {
        status: FriendRequestStatus.ACCEPTED,
      },
    });
    if (claimed.count === 0) return null;

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

    // Simultaneous requests in both directions become one friendship.
    await tx.friendRequest.updateMany({
      where: {
        senderId: request.receiverId,
        receiverId: request.senderId,
        status: FriendRequestStatus.PENDING,
      },
      data: { status: FriendRequestStatus.ACCEPTED },
    });
    return null;
  });

  if (result) return result;

  revalidateUserSocialPages();
  redirect(socialReturnPath(formData));
}

export async function rejectFriendRequest(
  requestIdValue: string,
  _state?: FormState,
  formData?: FormData,
): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const requestId = parseRecordId(requestIdValue);
  if (requestId === null) return { message: "申請IDが不正です。通知を更新してください。" };

  const result = await socialTransaction(async (tx) => {
    const request = await tx.friendRequest.findFirst({
      where: {
        id: requestId,
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      select: { senderId: true, receiverId: true },
    });
    if (!request) return;
    await lockUsers(tx, request.senderId, request.receiverId);
    await tx.friendRequest.updateMany({
      where: {
        id: requestId,
        receiverId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      data: {
        status: FriendRequestStatus.REJECTED,
      },
    });
  });

  if (result) return result;
  revalidateUserSocialPages();
  redirect(socialReturnPath(formData));
}

export async function cancelFriendRequest(
  requestIdValue: string,
  _state?: FormState,
  formData?: FormData,
): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const requestId = parseRecordId(requestIdValue);
  if (requestId === null) return { message: "申請IDが不正です。通知を更新してください。" };
  const result = await socialTransaction(async (tx) => {
    const request = await tx.friendRequest.findFirst({
      where: {
        id: requestId,
        senderId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
      select: { senderId: true, receiverId: true },
    });
    if (!request) return;
    await lockUsers(tx, request.senderId, request.receiverId);
    await tx.friendRequest.deleteMany({
      where: {
        id: requestId,
        senderId: currentUser.id,
        status: FriendRequestStatus.PENDING,
      },
    });
  });
  if (result) return result;
  revalidateUserSocialPages();
  redirect(socialReturnPath(formData));
}

export async function removeFriend(friendIdValue: string, _state?: FormState, formData?: FormData): Promise<FormState> {
  const currentUser = await requireCurrentUser();
  const friendId = parseRecordId(friendIdValue);
  if (friendId === null) return { message: "ユーザーIDが不正です。ページを更新してください。" };
  if (friendId === currentUser.id) return { message: "自分自身は解除できません。" };
  const result = await socialTransaction(async (tx) => {
    await lockUsers(tx, currentUser.id, friendId);
    const friendship = await tx.friendship.findUnique({
      where: { userId_friendId: { userId: currentUser.id, friendId } },
      select: { userId: true },
    });
    if (!friendship) return;
    await tx.friendship.deleteMany({
      where: { OR: [{ userId: currentUser.id, friendId }, { userId: friendId, friendId: currentUser.id }] },
    });
    await tx.friendRequest.deleteMany({
      where: { OR: [{ senderId: currentUser.id, receiverId: friendId }, { senderId: friendId, receiverId: currentUser.id }] },
    });
  });
  if (result) return result;
  revalidateUserSocialPages();
  redirect(socialReturnPath(formData));
}
