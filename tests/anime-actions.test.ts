import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, redirect } = vi.hoisted(() => ({
  db: {
    anime: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    animeTag: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
  redirect: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/current-user", () => ({
  requireCurrentUser: async () => ({ id: 1 }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));
import {
  createAnime,
  deleteAnime,
  featureAnime,
  unfeatureAnime,
  updateAnime,
} from "@/app/anime/actions";

const state = { message: "" };
function data(title = "作品") {
  const form = new FormData();
  form.set("title", title);
  form.set("rating", "S");
  form.set("status", "COMPLETED");
  return form;
}
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((callback) => callback(db));
  redirect.mockImplementation(() => {
    throw new Error("REDIRECT");
  });
});

describe("anime ownership and featured limits", () => {
  it("rejects invalid input without writing data", async () => {
    expect((await createAnime(state, data(" "))).message).toContain("必須");
    expect(db.anime.create).not.toHaveBeenCalled();
  });
  it("does not edit or delete tags for an unowned record", async () => {
    db.anime.findFirst.mockResolvedValue(null);
    expect((await updateAnime("99", state, data())).message).toContain(
      "見つかりません",
    );
    expect(db.anime.findFirst).toHaveBeenCalledWith({
      where: { id: 99, userId: 1 },
      select: { id: true },
    });
    expect(db.animeTag.deleteMany).not.toHaveBeenCalled();
    expect(db.anime.update).not.toHaveBeenCalled();
  });
  it("scopes deletion to the current user", async () => {
    await expect(deleteAnime("99")).rejects.toThrow("REDIRECT");
    expect(db.anime.deleteMany).toHaveBeenCalledWith({
      where: { id: 99, userId: 1 },
    });
  });
  it("locks the user before counting and blocks a fourth feature", async () => {
    db.anime.findFirst.mockResolvedValue({ id: 4, isFeatured: false });
    db.anime.count.mockResolvedValue(3);
    expect((await featureAnime("4")).message).toContain("3件まで");
    expect(db.$queryRaw).toHaveBeenCalled();
    expect(db.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      db.anime.count.mock.invocationCallOrder[0],
    );
    expect(db.anime.count).toHaveBeenCalledWith({
      where: { userId: 1, isFeatured: true },
    });
    expect(db.anime.update).not.toHaveBeenCalled();
  });
  it("does not move an already featured record to the top on a repeated request", async () => {
    db.anime.findFirst.mockResolvedValue({ id: 4, isFeatured: true });
    await expect(featureAnime("4")).rejects.toThrow("REDIRECT");
    expect(db.anime.count).not.toHaveBeenCalled();
    expect(db.anime.update).not.toHaveBeenCalled();
  });
  it("returns an error for unowned feature removal", async () => {
    db.anime.updateMany.mockResolvedValue({ count: 0 });
    expect((await unfeatureAnime("99")).message).toContain("見つかりません");
    expect(db.anime.updateMany).toHaveBeenCalledWith({
      where: { id: 99, userId: 1 },
      data: { isFeatured: false, featuredAt: null },
    });
  });
});
