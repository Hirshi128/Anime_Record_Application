import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, redirect, cookieSet, cookieGet, cookieDelete, requireUser } = vi.hoisted(() => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
    anime: { findMany: vi.fn(), updateMany: vi.fn() },
    friendRequest: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    friendship: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    authSession: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  redirect: vi.fn(),
  cookieSet: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/current-user", () => ({
  currentUserCookieName: "anime_record_user_id",
  requireCurrentUser: requireUser,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: cookieSet, get: cookieGet, delete: cookieDelete }) }));

import {
  acceptFriendRequest,
  cancelFriendRequest,
  createUser,
  loginUser,
  logoutUser,
  removeFriend,
  rejectFriendRequest,
  sendFriendRequest,
  updateUserProfile,
} from "@/app/users/actions";

const state = { message: "" };
function profile(ids: string[] = []) {
  const data = new FormData();
  data.set("displayName", "名前");
  data.set("username", "user_1");
  ids.forEach((id) => data.append("featuredAnimeIds", id));
  return data;
}

beforeEach(() => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue({ id: 1 });
  vi.stubEnv("AUTH_MODE", "demo");
  vi.stubEnv("VERCEL", "");
  db.$transaction.mockImplementation((callback) => callback(db));
  db.user.findUnique.mockResolvedValue(null);
  db.friendRequest.findFirst.mockResolvedValue(null);
  db.friendRequest.findUnique.mockResolvedValue(null);
  db.friendship.findUnique.mockResolvedValue(null);
  redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("profile and registration", () => {
  it.each([["displayName", 101], ["username", 65]] as const)("rejects oversized %s before profile queries or writes", async (field, length) => {
    const data = profile();
    data.set(field, "x".repeat(length));
    expect((await updateUserProfile(state, data)).message).not.toBe("");
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it.each(["lookup", "transaction"])("returns recoverable profile feedback for a %s failure", async (stage) => {
    const error = new Error("private database detail");
    if (stage === "lookup") db.user.findUnique.mockRejectedValue(error);
    else db.$transaction.mockRejectedValue(error);
    const result = await updateUserProfile(state, profile());
    expect(result.message).toContain("保存結果を確認できません");
    expect(result.message).not.toContain("private");
    expect(redirect).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.anime.updateMany).not.toHaveBeenCalled();
  });
  it("does not swallow profile authentication redirects or query before authorization", async () => {
    requireUser.mockRejectedValue(new Error("REDIRECT /users"));
    await expect(updateUserProfile(state, profile())).rejects.toThrow("REDIRECT /users");
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("retains the specific duplicate-username message for a profile write race", async () => {
    db.$transaction.mockRejectedValue({ code: "P2002" });
    expect((await updateUserProfile(state, profile())).message).toContain("すでに使われています");
    expect(redirect).not.toHaveBeenCalled();
  });
  it("updates only the authenticated profile and redirects outside the error handler", async () => {
    db.anime.findMany.mockResolvedValue([]);
    const data = profile(); data.set("userId", "2");
    await expect(updateUserProfile(state, data)).rejects.toThrow("REDIRECT");
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
    expect(db.anime.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 1 } }));
    expect(redirect).toHaveBeenCalledWith("/users/profile");
  });
  it("logs out locally and warns instead of exposing session-revocation DB failures", async () => {
    vi.stubEnv("AUTH_MODE", "credentials");
    cookieGet.mockReturnValue({ value: "a".repeat(64) });
    db.authSession.deleteMany.mockRejectedValue(new Error("private database error"));
    await expect(logoutUser()).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/users?logout=partial");
    expect(cookieDelete).toHaveBeenCalledWith("anime_record_session");
    expect(cookieDelete).toHaveBeenCalledWith("anime_record_user_id");
  });
  it("blocks legacy registration and numeric-ID login in credential mode before querying", async () => {
    vi.stubEnv("AUTH_MODE", "credentials");
    await expect(createUser(state, profile())).rejects.toThrow();
    const data = new FormData(); data.set("userId", "1");
    await expect(loginUser(data)).rejects.toThrow();
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
  it("returns a useful error for a duplicate ID without creating a user", async () => {
    db.user.findUnique.mockResolvedValue({ id: 2 });
    const result = await createUser(state, profile());
    expect(result.message).toContain("すでに使われています");
    expect(db.user.create).not.toHaveBeenCalled();
    expect(cookieSet).not.toHaveBeenCalled();
  });
  it("handles duplicate creation races", async () => {
    db.user.count.mockResolvedValue(3);
    db.user.create.mockRejectedValue({ code: "P2002" });
    expect((await createUser(state, profile())).message).toContain(
      "すでに使われています",
    );
    expect(cookieSet).not.toHaveBeenCalled();
  });
  it("refuses to feature another user's record before any profile writes", async () => {
    db.anime.findMany.mockResolvedValue([]);
    expect((await updateUserProfile(state, profile(["99"]))).message).toContain(
      "選択できない",
    );
    expect(db.anime.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [99] }, userId: 1 } }),
    );
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.anime.updateMany).not.toHaveBeenCalled();
  });
  it("rejects more than three choices before querying records", async () => {
    expect(
      (await updateUserProfile(state, profile(["1", "2", "3", "4"]))).message,
    ).toContain("3件まで");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("friend request consistency", () => {
  it("limits credential-mode friend request attempts per owner before any friendship mutation", async () => {
    vi.stubEnv("AUTH_MODE", "credentials");
    db.$queryRaw.mockResolvedValue([{ count: 11 }]);
    expect((await sendFriendRequest("2")).message).toContain("15分");
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.friendRequest.upsert).not.toHaveBeenCalled();
  });
  it("fails closed if credential-mode throttling cannot be checked", async () => {
    vi.stubEnv("AUTH_MODE", "credentials");
    db.$queryRaw.mockRejectedValue(new Error("private rate-limit DB error"));
    const result = await sendFriendRequest("2");
    expect(result.message).toContain("申請を確認できません");
    expect(result.message).not.toContain("private");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("allows a throttled credential request to proceed through the existing owner guards", async () => {
    vi.stubEnv("AUTH_MODE", "credentials");
    db.$queryRaw.mockResolvedValue([{ count: 1 }]); db.user.findUnique.mockResolvedValue({ id: 2 });
    await expect(sendFriendRequest("2")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { senderId: 1, receiverId: 2 } }));
  });
  it("keeps local demo requests compatible with the unmigrated DB", async () => {
    db.user.findUnique.mockResolvedValue({ id: 2 });
    await expect(sendFriendRequest("2")).rejects.toThrow("REDIRECT");
    expect(db.$queryRaw.mock.calls.every(([strings]) => !strings.join("").includes("AuthAttempt"))).toBe(true);
  });
  it.each([sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend])("returns retry feedback without exposing DB errors", async (action) => {
    db.$transaction.mockRejectedValue(new Error("postgresql://private-secret/database"));
    const result = await action("2");
    expect(result.message).toContain("ページを更新");
    expect(result.message).not.toContain("private-secret");
    expect(redirect).not.toHaveBeenCalled();
  });
  it.each([sendFriendRequest, acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend])("rejects malformed IDs without querying or replacing the page", async (action) => {
    expect((await action("1e2")).message).toContain("IDが不正");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("keeps the user's search and page context after a completed request", async () => {
    db.user.findUnique.mockResolvedValue({ id: 2 });
    const data = new FormData(); data.set("returnTo", "/users/search?q=anime&page=2&friendPage=3#user-results");
    await expect(sendFriendRequest("2", state, data)).rejects.toThrow("REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/users/search?q=anime&page=2&friendPage=3#user-results");
  });
  it("removes both directions only for the authenticated user's confirmed friendship", async () => {
    db.friendship.findUnique.mockResolvedValue({ userId: 1 });
    await expect(removeFriend("2")).rejects.toThrow("REDIRECT");
    expect(db.friendship.findUnique).toHaveBeenCalledWith({ where: { userId_friendId: { userId: 1, friendId: 2 } }, select: { userId: true } });
    expect(db.friendship.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ userId: 1, friendId: 2 }, { userId: 2, friendId: 1 }] } });
    expect(db.friendRequest.deleteMany).toHaveBeenCalledWith({ where: { OR: [{ senderId: 1, receiverId: 2 }, { senderId: 2, receiverId: 1 }] } });
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(db.friendship.findUnique.mock.invocationCallOrder[0]);
  });
  it("does not erase requests or unrelated relationships for a non-friend", async () => {
    await expect(removeFriend("3")).rejects.toThrow("REDIRECT");
    expect(db.friendship.deleteMany).not.toHaveBeenCalled();
    expect(db.friendRequest.deleteMany).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs and self-removal before any transaction", async () => {
    expect((await removeFriend("1e2")).message).toContain("ID");
    expect((await removeFriend("1")).message).toContain("自分自身");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("does not cancel a request unless the current user is its sender", async () => {
    await expect(cancelFriendRequest("8")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 8, senderId: 1, status: "PENDING" },
      select: { senderId: true, receiverId: true },
    });
    expect(db.friendRequest.deleteMany).not.toHaveBeenCalled();
  });
  it("only cancels a pending request, preserving an acceptance that won the race", async () => {
    db.friendRequest.findFirst.mockResolvedValue({
      senderId: 1,
      receiverId: 2,
    });
    await expect(cancelFriendRequest("8")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.deleteMany).toHaveBeenCalledWith({
      where: { id: 8, senderId: 1, status: "PENDING" },
    });
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.friendRequest.deleteMany.mock.invocationCallOrder[0],
    );
    expect(db.friendship.upsert).not.toHaveBeenCalled();
  });
  it("does not create a duplicate outgoing pending request", async () => {
    db.user.findUnique.mockResolvedValue({ id: 2 });
    db.friendRequest.findUnique.mockResolvedValue({ status: "PENDING" });
    await expect(sendFriendRequest("2")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.upsert).not.toHaveBeenCalled();
  });
  it("asks the receiver to accept an incoming request instead of sending a second one", async () => {
    db.user.findUnique.mockResolvedValue({ id: 2 });
    db.friendRequest.findFirst.mockResolvedValue({ id: 8 });
    expect((await sendFriendRequest("2")).message).toContain(
      "申請が届いています",
    );
    expect(db.friendRequest.upsert).not.toHaveBeenCalled();
  });
  it("refuses self requests", async () => {
    expect((await sendFriendRequest("1")).message).toContain("自分自身");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("requires request ownership before accepting", async () => {
    expect((await acceptFriendRequest("8")).message).toContain(
      "見つかりません",
    );
    expect(db.friendRequest.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8, receiverId: 1 } }),
    );
    expect(db.friendship.upsert).not.toHaveBeenCalled();
  });
  it("atomically claims a pending request and clears the reverse pending request", async () => {
    db.friendRequest.findFirst.mockResolvedValue({
      id: 8,
      senderId: 2,
      receiverId: 1,
      status: "PENDING",
    });
    db.friendRequest.updateMany.mockResolvedValue({ count: 1 });
    await expect(acceptFriendRequest("8")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 8, receiverId: 1, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
    expect(db.friendRequest.updateMany).toHaveBeenNthCalledWith(2, {
      where: { senderId: 1, receiverId: 2, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
    expect(db.friendship.upsert).toHaveBeenCalledTimes(2);
  });
  it("does not recreate friendships for an already accepted request", async () => {
    db.friendRequest.findFirst.mockResolvedValue({
      id: 8,
      senderId: 2,
      receiverId: 1,
      status: "ACCEPTED",
    });
    await expect(acceptFriendRequest("8")).rejects.toThrow("REDIRECT");
    expect(db.friendRequest.updateMany).not.toHaveBeenCalled();
    expect(db.friendship.upsert).not.toHaveBeenCalled();
  });
  it("does not create friendships when a concurrent response already claimed the request", async () => {
    db.friendRequest.findFirst.mockResolvedValue({
      id: 8,
      senderId: 2,
      receiverId: 1,
      status: "PENDING",
    });
    db.friendRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(acceptFriendRequest("8")).rejects.toThrow("REDIRECT");
    expect(db.friendship.upsert).not.toHaveBeenCalled();
  });
});
