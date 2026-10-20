import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const { requireUser, findUser, findAnime, countRequests, updateProfile } = vi.hoisted(() => ({
  requireUser: vi.fn(), findUser: vi.fn(), findAnime: vi.fn(),
  countRequests: vi.fn(), updateProfile: vi.fn(),
}));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: requireUser }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  user: { findUnique: findUser }, anime: { findMany: findAnime },
  friendRequest: { count: countRequests },
} }));
vi.mock("@/lib/auth-mode", () => ({ usesCredentialAuth: () => true }));
vi.mock("@/app/users/actions", () => ({ updateUserProfile: updateProfile }));
import UserProfilePage from "@/app/users/profile/page";

function owner(id: number) {
  requireUser.mockResolvedValue({ id });
  findUser.mockResolvedValue({ id, displayName: `Owner ${id}`, username: `owner_${id}`,
    favoriteGenres: [{ name: id === 1 ? "SF" : "音楽" }] });
  findAnime.mockResolvedValue([{ id: id * 10, title: `Pick ${id}`, rating: "S",
    status: "COMPLETED", isFeatured: true }]);
}
beforeEach(() => {
  vi.resetAllMocks();
  owner(1);
  countRequests.mockResolvedValue(0);
});

it("discards the previous owner's unsaved profile when the authenticated owner changes", async () => {
  const view = render(await UserProfilePage());
  fireEvent.change(screen.getByRole("textbox", { name: "表示名" }), { target: { value: "Private draft" } });
  fireEvent.change(screen.getByRole("textbox", { name: "ユーザーID" }), { target: { value: "private_draft" } });
  owner(2);
  view.rerender(await UserProfilePage());
  expect((screen.getByRole("textbox", { name: "表示名" }) as HTMLInputElement).value).toBe("Owner 2");
  expect((screen.getByRole("textbox", { name: "ユーザーID" }) as HTMLInputElement).value).toBe("owner_2");
  expect((screen.getByRole("checkbox", { name: "SF" }) as HTMLInputElement).checked).toBe(false);
  expect((screen.getByRole("checkbox", { name: "音楽" }) as HTMLInputElement).checked).toBe(true);
  expect((screen.getByRole("checkbox", { name: /Pick 2/ }) as HTMLInputElement).checked).toBe(true);
  expect(screen.queryByRole("checkbox", { name: /Pick 1/ })).toBeNull();
  expect(updateProfile).not.toHaveBeenCalled();
  expect(findAnime).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: 2 } }));
});

it("preserves an owner's unsaved edits during a same-owner server refresh", async () => {
  const view = render(await UserProfilePage());
  fireEvent.change(screen.getByRole("textbox", { name: "表示名" }), { target: { value: "Keep draft" } });
  fireEvent.click(screen.getByRole("checkbox", { name: "音楽" }));
  view.rerender(await UserProfilePage());
  expect((screen.getByRole("textbox", { name: "表示名" }) as HTMLInputElement).value).toBe("Keep draft");
  expect((screen.getByRole("checkbox", { name: "音楽" }) as HTMLInputElement).checked).toBe(true);
  expect(updateProfile).not.toHaveBeenCalled();
});

it("does not load profile data before authentication", async () => {
  requireUser.mockRejectedValue(new Error("Unauthenticated"));
  await expect(UserProfilePage()).rejects.toThrow("Unauthenticated");
  expect(findUser).not.toHaveBeenCalled();
  expect(findAnime).not.toHaveBeenCalled();
  expect(countRequests).not.toHaveBeenCalled();
});
