import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
const { count, findMany, friendCount, friendFindMany, requestCount, requestFindMany, refresh, removeFriend } = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  friendCount: vi.fn(),
  friendFindMany: vi.fn(),
  requestCount: vi.fn(),
  requestFindMany: vi.fn(),
  refresh: vi.fn(),
  removeFriend: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count, findMany },
    friendRequest: { findMany: requestFindMany, count: requestCount },
    friendship: { findMany: friendFindMany, count: friendCount },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUser: async () => ({ id: 1 }),
}));
vi.mock("@/app/users/actions", () => ({
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  sendFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend,
}));
import UserSearchPage from "@/app/users/search/page";

beforeEach(() => {
  vi.resetAllMocks();
  count.mockResolvedValue(61);
  findMany.mockResolvedValue([]);
  friendCount.mockResolvedValue(0);
  friendFindMany.mockResolvedValue([]);
  requestCount.mockResolvedValue(0);
  requestFindMany.mockResolvedValue([]);
});
describe("user search pagination", () => {
  it("refreshes notifications without submitting friend actions", async () => {
    render(await UserSearchPage({ searchParams: Promise.resolve({}) }));
    await userEvent.setup().click(screen.getByRole("button", { name: "通知を更新" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(removeFriend).not.toHaveBeenCalled();
  });
  it("paginates notifications without losing other page context or incoming states", async () => {
    requestCount.mockResolvedValue(25);
    friendCount.mockResolvedValue(25);
    findMany.mockResolvedValue([{ id: 2, displayName: "Friend", username: "friend", anime: [], favoriteGenres: [] }]);
    requestFindMany.mockImplementation((options) => options.where.senderId ? [{ id: 99, senderId: 2 }] : []);
    render(await UserSearchPage({ searchParams: Promise.resolve({ q: "anime", page: "2", friendPage: "2", requestPage: "2" }) }));
    expect(requestFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 12, skip: 12, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }));
    expect(requestFindMany).toHaveBeenCalledWith({ where: { receiverId: 1, senderId: { in: [2] }, status: "PENDING" }, select: { id: true, senderId: true } });
    const pager = screen.getByRole("navigation", { name: "フレンド申請のページ" });
    expect(pager.querySelector("a:last-child")?.getAttribute("href")).toBe("/users/search?q=anime&page=2&friendPage=2&requestPage=3#friend-requests");
    expect(screen.getByRole("button", { name: "承認" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "フレンド申請" })).toBeNull();
  });
  it("requires confirmation before removing a friend and submits only the selected ID", async () => {
    friendCount.mockResolvedValue(1);
    friendFindMany.mockImplementation((options) => options.include ? [{ friendId: 2, friend: { displayName: "Friend", username: "friend_2", anime: [] } }] : []);
    removeFriend.mockResolvedValue({ message: "" });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    try {
      render(await UserSearchPage({ searchParams: Promise.resolve({}) }));
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: "フレンド解除" }));
      expect(confirm).toHaveBeenCalledWith("Friendさんとのフレンド関係を解除しますか？");
      expect(removeFriend).not.toHaveBeenCalled();
      confirm.mockReturnValue(true);
      await user.click(screen.getByRole("button", { name: "フレンド解除" }));
      expect(removeFriend).toHaveBeenCalledWith("2", { message: "" }, expect.any(FormData));
      expect(removeFriend.mock.calls[0][2].get("returnTo")).toBe("/users/search#friends");
    } finally { confirm.mockRestore(); }
  });
  it("paginates friends independently while preserving the user search page", async () => {
    friendCount.mockResolvedValue(25);
    friendFindMany.mockImplementation((options) =>
      options.include
        ? [
            {
              friendId: 2,
              friend: {
                displayName: "フレンド",
                username: "friend_2",
                anime: [],
              },
            },
          ]
        : [],
    );
    render(
      await UserSearchPage({
        searchParams: Promise.resolve({
          q: "anime",
          page: "2",
          friendPage: "2",
        }),
      }),
    );
    expect(friendFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 12,
        skip: 12,
        orderBy: [{ createdAt: "desc" }, { friendId: "asc" }],
      }),
    );
    const friendPager = screen.getByRole("navigation", {
      name: "フレンド一覧のページ",
    });
    expect(
      friendPager.querySelector("a:last-child")?.getAttribute("href"),
    ).toBe("/users/search?q=anime&page=2&friendPage=3#friends");
    const userPager = screen.getByRole("navigation", {
      name: "ユーザー検索のページ",
    });
    expect(userPager.querySelector("a:last-child")?.getAttribute("href")).toBe(
      "/users/search?q=anime&page=3&friendPage=2#user-results",
    );
  });
  it("uses the second page and preserves the query in navigation", async () => {
    render(
      await UserSearchPage({
        searchParams: Promise.resolve({ q: "test & anime", page: "2" }),
      }),
    );
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 30, skip: 30 }),
    );
    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        AND: expect.arrayContaining([
          { id: { not: 1 } },
          {
            OR: [
              {
                displayName: { contains: "test & anime", mode: "insensitive" },
              },
              { username: { contains: "test & anime", mode: "insensitive" } },
            ],
          },
        ]),
      }),
    });
    expect(
      screen.getByRole("link", { name: "次のページ →" }).getAttribute("href"),
    ).toBe("/users/search?q=test+%26+anime&page=3#user-results");
    expect(
      screen.getByRole("link", { name: "← 前のページ" }).getAttribute("href"),
    ).toBe("/users/search?q=test+%26+anime#user-results");
  });
  it.each(["-1", "0", "bad", "1.5", "9007199254740992"])(
    "defaults invalid page %s to the first page",
    async (page) => {
      await UserSearchPage({ searchParams: Promise.resolve({ page }) });
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0 }),
      );
    },
  );
  it("clamps out-of-range pages to existing results", async () => {
    await UserSearchPage({ searchParams: Promise.resolve({ page: "99999" }) });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 60 }),
    );
  });
});
