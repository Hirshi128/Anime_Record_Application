import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { count, findMany } = vi.hoisted(() => ({ count: vi.fn(), findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { anime: { count, findMany }, friendRequest: { count: async () => 0 } } }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: async () => ({ id: 7, displayName: "Test" }) }));
vi.mock("@/app/users/actions", () => ({ logoutUser: vi.fn() }));
import AnimeListPage from "@/app/anime/page";
beforeEach(() => { vi.resetAllMocks(); count.mockResolvedValue(50); findMany.mockResolvedValue([]); });

it("bounds the owner's list and retains all filters, sorting, and repeated genres on page links", async () => {
  render(await AnimeListPage({ searchParams: Promise.resolve({ q: "作品 & test", rating: "SS", status: "COMPLETED", tag: ["アクション", "SF"], tagMode: "all", sort: "rating", page: "2" }) }));
  expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ AND: expect.arrayContaining([{ userId: 7 }, { rating: "SS" }, { status: "COMPLETED" }]) }) });
  expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ take: 24, skip: 24, orderBy: [{ rating: "asc" }, { updatedAt: "desc" }, { id: "desc" }] }));
  const next = new URL(screen.getByRole("link", { name: "次のページ →" }).getAttribute("href")!, "https://local.invalid");
  expect(next.pathname).toBe("/anime");
  expect(next.searchParams.get("q")).toBe("作品 & test");
  expect(next.searchParams.getAll("tag")).toEqual(["アクション", "SF"]);
  expect(Object.fromEntries(next.searchParams)).toMatchObject({ rating: "SS", status: "COMPLETED", tagMode: "all", sort: "rating", page: "3" });
  expect(next.hash).toBe("#anime-results");
  expect(screen.getByText("Testさんの記録 / 50件")).toBeTruthy();
  expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { userId: 7, isFeatured: true }, take: 3 }));
});
it.each(["bad", "-1", "0", "1.5", "9007199254740992"])("defaults invalid page %s and sorting to stable update order", async (page) => {
  await AnimeListPage({ searchParams: Promise.resolve({ page, sort: "bad" }) });
  expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 0, orderBy: [{ updatedAt: "desc" }, { id: "desc" }] }));
});
it("clamps pages and uses stable title ordering", async () => {
  await AnimeListPage({ searchParams: Promise.resolve({ page: "999", sort: "title" }) });
  expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 48, orderBy: [{ title: "asc" }, { id: "desc" }] }));
});
it("does not render a pager when there are no records", async () => {
  count.mockResolvedValue(0);
  render(await AnimeListPage({ searchParams: Promise.resolve({ page: "99" }) }));
  expect(screen.queryByRole("navigation", { name: "アニメ一覧のページ" })).toBeNull();
  expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ skip: 0 }));
});
