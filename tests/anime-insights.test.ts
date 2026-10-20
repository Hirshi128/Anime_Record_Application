// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const { queryRaw, requireUser } = vi.hoisted(() => ({ queryRaw: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: requireUser }));
import { getCurrentUserInsights, summarizeAnimeInsights } from "@/lib/anime-insights";
const db = new PGlite();
beforeAll(async () => {
  const folder = resolve("prisma/postgres-migrations");
  for (const name of readdirSync(folder).sort().filter((name) => !name.endsWith(".toml"))) await db.exec(readFileSync(resolve(folder, name, "migration.sql"), "utf8"));
}, 30_000);
beforeEach(async () => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue({ id: 1, displayName: "Owner" });
  queryRaw.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => db.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, ""), values).then((result) => result.rows));
  await db.exec('TRUNCATE "User", "Tag" RESTART IDENTITY CASCADE');
});
afterAll(() => db.close());
it("aggregates only the signed-in owner's completed records, without duplicating multi-genre works", async () => {
  await db.exec(`
    INSERT INTO "User" ("username", "displayName") VALUES ('owner', 'Owner'), ('other', 'Other');
    INSERT INTO "Anime" ("title", "rating", "status", "userId") VALUES
      ('Own SS', 'SS', 'COMPLETED', 1), ('Own D', 'D', 'COMPLETED', 1),
      ('Watching S', 'S', 'WATCHING', 1), ('Other SS', 'SS', 'COMPLETED', 2),
      ('Planned SS', 'SS', 'PLAN_TO_WATCH', 1), ('Dropped S', 'S', 'DROPPED', 1);
    INSERT INTO "Tag" ("name") VALUES ('Action'), ('SF'), ('Private other');
    INSERT INTO "AnimeTag" VALUES (1, 1), (1, 2), (2, 1), (3, 1), (4, 3), (5, 2), (6, 1);
  `);
  const result = await getCurrentUserInsights();
  expect(result.ownerName).toBe("Owner");
  expect(result.completedCount).toBe(2);
  expect(result.highRatedCount).toBe(1);
  expect(result.ratings.map((row) => row.count)).toEqual([1, 0, 0, 0, 0, 1]);
  expect(result.genres).toEqual([{ name: "Action", count: 2, highCount: 1, highPercentage: 50 }, { name: "SF", count: 1, highCount: 1, highPercentage: 100 }]);
  expect(queryRaw.mock.calls[0].slice(1)).toEqual([1]);
});
it("does not query when authorization fails", async () => {
  requireUser.mockRejectedValue(new Error("REDIRECT /users"));
  await expect(getCurrentUserInsights()).rejects.toThrow("REDIRECT");
  expect(queryRaw).not.toHaveBeenCalled();
});
it("keeps untagged completed records in the total and rating distribution", async () => {
  await db.exec(`INSERT INTO "User" ("username", "displayName") VALUES ('owner', 'Owner');
    INSERT INTO "Anime" ("title", "rating", "status", "userId") VALUES ('Untagged favorite', 'S', 'COMPLETED', 1);`);
  const result = await getCurrentUserInsights();
  expect(result.completedCount).toBe(1);
  expect(result.highRatedCount).toBe(1);
  expect(result.ratings.find((row) => row.rating === "S")?.count).toBe(1);
  expect(result.genres).toEqual([]);
});
it("returns an empty summary without invalid percentages", async () => {
  expect(await getCurrentUserInsights()).toMatchObject({ completedCount: 0, highRatedCount: 0, genres: [] });
  expect(summarizeAnimeInsights([{ kind: "genre", name: "None", total: 0, high: 0 }]).genres[0].highPercentage).toBe(0);
});
it("normalizes rating order and rounds percentages without turning ratings into arbitrary scores", () => {
  const result = summarizeAnimeInsights([{ kind: "rating", name: "A", total: 3, high: 0 }, { kind: "rating", name: "S", total: 1, high: 1 }, { kind: "genre", name: "Drama", total: 3, high: 1 }]);
  expect(result.ratings.map((row) => row.rating)).toEqual(["SS", "S", "A", "B", "C", "D"]);
  expect(result.highRatedCount).toBe(1);
  expect(result.genres[0].highPercentage).toBe(33);
});
