import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), current: vi.fn() }));

vi.mock("@/lib/current-user", () => ({ getCurrentUser: mocks.current }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: mocks.findMany,
    },
  },
}));
vi.mock("@/app/users/actions", () => ({
  loginUser: vi.fn(),
  createUser: vi.fn(),
  logoutUser: vi.fn(),
}));

import UsersPage from "@/app/users/page";

beforeEach(() => {
  vi.stubEnv("AUTH_MODE", "demo"); vi.stubEnv("VERCEL", "");
  mocks.current.mockResolvedValue(null);
  mocks.findMany.mockResolvedValue([
    { id: 1, displayName: "First user", username: "first_user" },
    { id: 2, displayName: "Second user", username: "second_user" },
  ]);
});
afterEach(() => vi.unstubAllEnvs());

it("does not query or expose the public selector in credential mode", async () => {
  vi.stubEnv("AUTH_MODE", "credentials");
  render(await UsersPage());
  expect(mocks.findMany).not.toHaveBeenCalled();
  expect(screen.queryByText("First user")).toBeNull();
  expect(screen.getByRole("heading", { name: "ログイン・新規登録" })).toBeTruthy();
});
it("announces incomplete server-side logout without database details", async () => {
  vi.stubEnv("AUTH_MODE", "credentials");
  render(await UsersPage({ searchParams: Promise.resolve({ logout: "partial" }) }));
  expect(screen.getByRole("alert").textContent).toContain("この端末からログアウト");
  expect(screen.getByRole("alert").textContent).toContain("失効を確認できません");
});

it("offers account settings and logout instead of credential forms when logged in", async () => {
  vi.stubEnv("AUTH_MODE", "credentials");
  mocks.current.mockResolvedValue({ id: 7, displayName: "Current" });
  render(await UsersPage());
  expect(screen.getByRole("heading", { name: "アカウント" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "パスワード変更" }).getAttribute("href")).toBe("/users/account");
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
  expect(screen.queryByLabelText("パスワード")).toBeNull();
  expect(mocks.findMany).not.toHaveBeenCalled();
});

it("places existing users before registration in reading and keyboard order", async () => {
  render(await UsersPage());
  const user = userEvent.setup();
  const loginButtons = screen.getAllByRole("button", { name: "ログイン" });
  const registrationInput = screen.getByRole("textbox", { name: "表示名" });
  expect(
    loginButtons[0].compareDocumentPosition(registrationInput) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  const loginSection = loginButtons[0].closest("section");
  const registrationSection = registrationInput.closest("section");
  expect(loginSection?.className).not.toMatch(/order-/);
  expect(registrationSection?.className).not.toMatch(/order-/);

  await user.tab();
  expect(document.activeElement).toBe(
    screen.getByRole("link", { name: "ホームへ戻る" }),
  );
  await user.tab();
  expect(document.activeElement).toBe(loginButtons[0]);
  await user.tab();
  expect(document.activeElement).toBe(loginButtons[1]);
  await user.tab();
  expect(document.activeElement).toBe(registrationInput);
});
