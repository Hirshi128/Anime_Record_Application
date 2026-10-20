// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const { queryRaw, requireUser } = vi.hoisted(() => ({ queryRaw: vi.fn(), requireUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: requireUser }));
import { getCurrentUserFriendRecommendations } from "@/lib/friend-recommendations";
const db = new PGlite();
beforeAll(async () => {
  const folder = resolve("prisma/postgres-migrations");
  for (const name of readdirSync(folder).sort().filter((name) => !name.endsWith(".toml"))) await db.exec(readFileSync(resolve(folder, name, "migration.sql"), "utf8"));
}, 30_000);
beforeEach(async () => {
  vi.resetAllMocks(); requireUser.mockResolvedValue({ id: 1 });
  queryRaw.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => db.query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, ""), values).then((result) => result.rows));
  await db.exec(`TRUNCATE "User", "Tag" RESTART IDENTITY CASCADE;
    INSERT INTO "User" ("username", "displayName") VALUES ('owner', 'Owner'), ('friend', 'Friend'), ('stranger', 'Stranger'), ('second_friend', 'Second');
    INSERT INTO "Friendship" ("userId", "friendId") VALUES (1, 2), (2, 1), (1, 4), (4, 1);
    INSERT INTO "Tag" ("name") VALUES ('SF'), ('Drama'), ('Other');
    INSERT INTO "Anime" ("title", "rating", "status", "userId") VALUES ('Own favorite', 'S', 'COMPLETED', 1);
    INSERT INTO "AnimeTag" VALUES (1, 1), (1, 2);`);
});
afterAll(() => db.close());
async function pick(id: number, title: string, userId = 2, tags = [1], rating = "S", featured = true) {
  await db.query('INSERT INTO "Anime" ("id", "title", "rating", "userId", "isFeatured", "review") VALUES ($1, $2, $3, $4, $5, $6)', [id, title, rating, userId, featured, "private review"]);
  for (const tag of tags) await db.query('INSERT INTO "AnimeTag" VALUES ($1, $2)', [id, tag]);
}
it("returns only matching friends' featured picks with public fields and explicit reasons", async () => {
  await pick(10, "Match", 2, [1, 2]); await pick(11, "Private", 2, [1], "SS", false);
  await pick(12, "Stranger pick", 3); await pick(13, "Wrong genre", 2, [3]);
  await pick(14, "Self", 1); await pick(15, "Orphan", 3);
  await pick(16, " 　\t ");
  await db.exec('UPDATE "Anime" SET "userId" = NULL WHERE "id" = 15');
  const rows = await getCurrentUserFriendRecommendations();
  expect(rows).toEqual([{ id: 10, title: "Match", rating: "S", friendName: "Friend", username: "friend", genres: ["Drama", "SF"] }]);
  expect(queryRaw.mock.calls[0].slice(1)).toEqual([1, 1, 1]);
});
it("excludes every registered status and merges width/case/whitespace title variants", async () => {
  await pick(10, "  ＳＦ　 STORY ", 1);
  await db.exec('UPDATE "Anime" SET "status" = \'PLAN_TO_WATCH\' WHERE "id" = 10');
  await pick(11, "sf   story", 2);
  await pick(12, "New title", 2, [1], "S");
  await pick(13, "Ｎｅｗ　title", 4, [1], "SS");
  const rows = await getCurrentUserFriendRecommendations();
  expect(rows.map((row) => row.id)).toEqual([13]);
});
it("uses only the owner's completed SS/S genres, not other ratings or other users' tastes", async () => {
  await db.exec('UPDATE "Anime" SET "status" = \'WATCHING\' WHERE "id" = 1');
  await pick(10, "Match");
  await pick(20, "Other owner's private favorite", 3, [1], "SS", false);
  await db.exec('UPDATE "Anime" SET "status" = \'COMPLETED\' WHERE "id" = 20');
  expect(await getCurrentUserFriendRecommendations()).toEqual([]);
  await db.exec('UPDATE "Anime" SET "status" = \'COMPLETED\', "rating" = \'A\' WHERE "id" = 1');
  expect(await getCurrentUserFriendRecommendations()).toEqual([]);
  await db.exec('UPDATE "Anime" SET "rating" = \'SS\' WHERE "id" = 1');
  expect((await getCurrentUserFriendRecommendations()).map((row) => row.id)).toEqual([10]);
});
it("orders by matching genres then rating, keeps ties stable, and caps results at six", async () => {
  for (let id = 10; id < 18; id++) await pick(id, `Pick ${id}`, 2, [1], "SS");
  await pick(18, "Two matching genres", 2, [1, 2], "A");
  const rows = await getCurrentUserFriendRecommendations();
  expect(rows.map((row) => row.id)).toEqual([18, 17, 16, 15, 14, 13]);
});
it("stops suggesting removed friends and does not treat pending requests as friendship", async () => {
  await pick(10, "Former friend"); await pick(11, "Pending friend", 3);
  await db.exec('DELETE FROM "Friendship" WHERE "userId" = 1 AND "friendId" = 2; INSERT INTO "FriendRequest" ("senderId", "receiverId") VALUES (3, 1)');
  expect(await getCurrentUserFriendRecommendations()).toEqual([]);
});
it("fails closed before querying when authentication is missing", async () => {
  requireUser.mockRejectedValue(new Error("REDIRECT /users"));
  await expect(getCurrentUserFriendRecommendations()).rejects.toThrow("REDIRECT /users");
  expect(queryRaw).not.toHaveBeenCalled();
});
