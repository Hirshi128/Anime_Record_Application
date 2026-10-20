// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: queryRaw } }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
import { allowAuthAttempt } from "@/lib/auth-session";

const db = new PGlite();
beforeAll(async () => {
  const folder = resolve("prisma/postgres-migrations");
  for (const entry of readdirSync(folder, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    await db.exec(readFileSync(resolve(folder, entry.name, "migration.sql"), "utf8"));
  }
  queryRaw.mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.reduce((text, part, index) => text + (index ? `$${index}` : "") + part, "");
    return db.query(sql, values).then((result) => result.rows);
  });
}, 30_000);
beforeEach(async () => { await db.exec('TRUNCATE "AuthAttempt", "User" CASCADE'); });
afterAll(async () => { await db.close(); });

it("orders persisted ratings from SS to D, as used by the high-rating list sort", async () => {
  await db.exec(`INSERT INTO "User" ("id", "username", "displayName") VALUES (1, 'sort_owner', 'Owner');
    INSERT INTO "Anime" ("title", "rating", "userId") VALUES ('D', 'D', 1), ('A', 'A', 1), ('SS', 'SS', 1), ('C', 'C', 1), ('S', 'S', 1), ('B', 'B', 1);`);
  expect((await db.query<{ rating: string }>('SELECT "rating" FROM "Anime" WHERE "userId" = 1 ORDER BY "rating" ASC')).rows.map((row) => row.rating)).toEqual(["SS", "S", "A", "B", "C", "D"]);
});

it("enforces unique emails, preserves existing users, and cascades session revocation", async () => {
  await db.exec(`INSERT INTO "User" ("id", "username", "displayName", "updatedAt") VALUES (1, 'legacy', 'Legacy', CURRENT_TIMESTAMP), (2, 'new_user', 'New', CURRENT_TIMESTAMP)`);
  await db.query('INSERT INTO "UserCredential" VALUES ($1, $2, $3)', [2, "new@example.com", "hash"]);
  await expect(db.query('INSERT INTO "UserCredential" VALUES ($1, $2, $3)', [1, "new@example.com", "hash"])).rejects.toThrow();
  expect((await db.query('SELECT * FROM "UserCredential" WHERE "userId" = 1')).rows).toHaveLength(0);
  await db.query('INSERT INTO "AuthSession" VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL \'14 days\')', ["digest", 2]);
  await db.exec('DELETE FROM "User" WHERE "id" = 2');
  expect((await db.query('SELECT * FROM "AuthSession"')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect((await db.query('SELECT "id" FROM "User"')).rows).toEqual([{ id: 1 }]);
});
it("atomically limits concurrent attempts and allows a fresh window", async () => {
  const outcomes = await Promise.all(Array.from({ length: 20 }, () => allowAuthAttempt("test@example.com", "login", 8)));
  expect(outcomes.filter(Boolean)).toHaveLength(8);
  const rows = (await db.query<{ key: string; count: number }>('SELECT "key", "count" FROM "AuthAttempt"')).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].count).toBe(20);
  expect(rows[0].key).not.toContain("test@example.com");
  expect(await allowAuthAttempt("test@example.com", "signup", 5)).toBe(true);
  await db.exec('UPDATE "AuthAttempt" SET "expiresAt" = (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') - INTERVAL \'1 minute\'');
  expect(await allowAuthAttempt("test@example.com", "login", 8)).toBe(true);
});
it("separates friend request limits by owner and from password/login attempts", async () => {
  const attempts = await Promise.all(Array.from({ length: 13 }, () => allowAuthAttempt("1", "friend-request", 10)));
  expect(attempts.filter(Boolean)).toHaveLength(10);
  expect(await allowAuthAttempt("2", "friend-request", 10)).toBe(true);
  expect(await allowAuthAttempt("1", "password", 5)).toBe(true);
  await db.exec('UPDATE "AuthAttempt" SET "expiresAt" = (CURRENT_TIMESTAMP AT TIME ZONE \'UTC\') - INTERVAL \'1 minute\'');
  expect(await allowAuthAttempt("1", "friend-request", 10)).toBe(true);
});
