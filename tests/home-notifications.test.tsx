import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
const { getUser, count } = vi.hoisted(() => ({ getUser: vi.fn(), count: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ getCurrentUser: getUser }));
vi.mock("@/lib/prisma", () => ({ prisma: { friendRequest: { count } } }));
import Home from "@/app/page";

it("opens the personal library without authentication, friends, or database reads", () => {
  render(<Home />);
  expect(getUser).not.toHaveBeenCalled();
  expect(count).not.toHaveBeenCalled();
  expect(screen.getByRole("heading", { name: "Anime Record" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "アニメを記録" })).toBeTruthy();
  expect(screen.queryByText("フレンド検索")).toBeNull();
  expect(screen.queryByText("ログイン")).toBeNull();
});
