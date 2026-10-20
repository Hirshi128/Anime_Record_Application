import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const { requireUser, createAnime } = vi.hoisted(() => ({ requireUser: vi.fn(), createAnime: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: requireUser }));
vi.mock("@/app/anime/actions", () => ({ createAnime }));
import AnimeNewPage from "@/app/anime/new/page";
beforeEach(() => { vi.resetAllMocks(); requireUser.mockResolvedValue({ id: 7, displayName: "Owner" }); });
it("prefills only the title and never copies a friend's rating, review, or ownership", async () => {
  render(await AnimeNewPage({ searchParams: Promise.resolve({ title: "Shared & title", rating: "SS", status: "COMPLETED", review: "private", userId: "9" }) }));
  expect((screen.getByRole("combobox", { name: "タイトル" }) as HTMLInputElement).value).toBe("Shared & title");
  expect((screen.getByRole("combobox", { name: "評価" }) as HTMLSelectElement).value).toBe("A");
  expect((screen.getByRole("combobox", { name: "視聴状況" }) as HTMLSelectElement).value).toBe("WATCHING");
  expect((screen.getByRole("textbox", { name: "感想" }) as HTMLTextAreaElement).value).toBe("");
  expect(document.querySelector('input[name="userId"]')).toBeNull();
  expect(createAnime).not.toHaveBeenCalled();
});
it("remounts the draft when client navigation changes the requested title", async () => {
  const view = render(await AnimeNewPage({ searchParams: Promise.resolve({ title: "First" }) }));
  view.rerender(await AnimeNewPage({ searchParams: Promise.resolve({ title: "Second" }) }));
  expect((screen.getByRole("combobox", { name: "タイトル" }) as HTMLInputElement).value).toBe("Second");
  expect(createAnime).not.toHaveBeenCalled();
});
it("rejects anonymous access before reading the query or invoking an action", async () => {
  requireUser.mockRejectedValue(new Error("REDIRECT /users"));
  await expect(AnimeNewPage({ searchParams: new Promise(() => {}) })).rejects.toThrow("REDIRECT /users");
  expect(createAnime).not.toHaveBeenCalled();
});
it("does not keep a previous owner's personal draft if the authenticated owner changes", async () => {
  const view = render(await AnimeNewPage({ searchParams: Promise.resolve({ title: "Shared title" }) }));
  fireEvent.change(screen.getByRole("textbox", { name: "感想" }), { target: { value: "First owner's draft" } });
  requireUser.mockResolvedValue({ id: 8, displayName: "Second" });
  view.rerender(await AnimeNewPage({ searchParams: Promise.resolve({ title: "Shared title" }) }));
  expect((screen.getByRole("textbox", { name: "感想" }) as HTMLTextAreaElement).value).toBe("");
  expect((screen.getByRole("combobox", { name: "タイトル" }) as HTMLInputElement).value).toBe("Shared title");
  expect(createAnime).not.toHaveBeenCalled();
});
