import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { load, recommend } = vi.hoisted(() => ({ load: vi.fn(), recommend: vi.fn() }));
vi.mock("@/lib/anime-insights", () => ({ getCurrentUserInsights: load }));
vi.mock("@/lib/friend-recommendations", () => ({ getCurrentUserFriendRecommendations: recommend }));
import AnimeInsightsPage from "@/app/anime/insights/page";
beforeEach(() => { vi.resetAllMocks(); recommend.mockResolvedValue([]); });
it("shows the friend and matching genres without linking to another owner's private record", async () => {
  load.mockResolvedValue({ ownerName: "Owner", completedCount: 1, highRatedCount: 1, genres: [], ratings: [] });
  recommend.mockResolvedValue([{ id: 90, title: "A new favorite", rating: "SS", friendName: "Friend", username: "friend_2", genres: ["SF"] }]);
  render(await AnimeInsightsPage());
  expect(screen.getByRole("heading", { name: "A new favorite" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Friend" }).getAttribute("href")).toBe("/users/search?q=friend_2");
  expect(screen.getByRole("list", { name: "おすすめの根拠となる共通ジャンル" }).textContent).toBe("SF");
  expect(document.querySelector('a[href="/anime/90"]')).toBeNull();
  const registration = new URL(screen.getByRole("link", { name: "記録する" }).getAttribute("href")!, "https://local.invalid");
  expect(registration.pathname).toBe("/anime/new");
  expect([...registration.searchParams]).toEqual([["title", "A new favorite"]]);
});
it("shows an actionable empty state without misleading genre claims", async () => {
  load.mockResolvedValue({ ownerName: "Owner", completedCount: 0, highRatedCount: 0, genres: [], ratings: [] });
  render(await AnimeInsightsPage());
  expect(screen.getByText("視聴済みの記録はまだありません。")).toBeTruthy();
  expect(screen.getByRole("link", { name: "アニメ一覧を開く" }).getAttribute("href")).toBe("/anime");
  expect(screen.queryByRole("table")).toBeNull();
});
it("renders accessible counts and genre links to the matching high-rating list", async () => {
  load.mockResolvedValue({ ownerName: "Owner", completedCount: 2, highRatedCount: 1, ratings: [{ rating: "SS", count: 1 }], genres: [{ name: "SF", count: 2, highCount: 1, highPercentage: 50 }] });
  render(await AnimeInsightsPage());
  expect(screen.getByRole("meter", { name: "SSの作品数" }).getAttribute("aria-valuetext")).toBe("1作品 / 2作品");
  expect(screen.getByRole("link", { name: "SF" }).getAttribute("href")).toBe("/anime?status=COMPLETED&tag=SF&sort=rating");
  expect(screen.getByText("50%")).toBeTruthy();
  expect(screen.getByText("Ownerさん / 集計対象：視聴済みの記録")).toBeTruthy();
});
it("shows legacy custom genres without linking to an unsupported genre filter", async () => {
  load.mockResolvedValue({ ownerName: "Owner", completedCount: 1, highRatedCount: 1, ratings: [], genres: [{ name: "Custom legacy tag", count: 1, highCount: 1, highPercentage: 100 }] });
  render(await AnimeInsightsPage());
  expect(screen.getByRole("rowheader", { name: "Custom legacy tag" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Custom legacy tag" })).toBeNull();
});
