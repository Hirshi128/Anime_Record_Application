// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ prisma: {} as Record<string, unknown>, cookies: new Map<string, string>(), failSession: false, failFriendCleanup: false }));
vi.mock("@/lib/prisma", () => ({ prisma: state.prisma }));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => state.cookies.has(name) ? { value: state.cookies.get(name) } : undefined,
  set: (name: string, value: string) => state.cookies.set(name, value),
  delete: (name: string) => state.cookies.delete(name),
}) }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { signIn, signUp } from "@/app/users/auth-actions";
import { changePassword } from "@/app/users/account/actions";
import { getCurrentUser } from "@/lib/current-user";
import { clearSession, sessionCookieName, tokenDigest } from "@/lib/auth-session";
import { removeFriend } from "@/app/users/actions";
import { provisionLegacyOwner } from "../scripts/legacy-credentials.mjs";

const db = new PGlite();
type Connection = Pick<PGlite, "query">;
function api(connection: Connection) {
  async function query<T>(sql: string, values: unknown[] = []) {
    try { return (await connection.query<T>(sql, values)).rows; }
    catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") throw { code: "P2002" };
      throw error;
    }
  }
  return {
    $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => query(strings.reduce((sql, part, index) => sql + (index ? `$${index}` : "") + part, ""), values),
    user: { create: async ({ data }: { data: { username: string; displayName: string; credential: { create: { email: string; passwordHash: string } } } }) => {
      const [user] = await query<{ id: number }>('INSERT INTO "User" ("username", "displayName") VALUES ($1, $2) RETURNING "id"', [data.username, data.displayName]);
      await query('INSERT INTO "UserCredential" ("userId", "email", "passwordHash") VALUES ($1, $2, $3)', [user.id, data.credential.create.email, data.credential.create.passwordHash]);
      return user;
    } },
    userCredential: {
      findUnique: async ({ where }: { where: { email?: string; userId?: number } }) => (await query<{ userId: number; email: string; passwordHash: string }>(`SELECT * FROM "UserCredential" WHERE "${where.email ? "email" : "userId"}" = $1`, [where.email ?? where.userId]))[0] ?? null,
      update: async ({ where, data }: { where: { userId: number }; data: { passwordHash: string } }) => (await query('UPDATE "UserCredential" SET "passwordHash" = $1 WHERE "userId" = $2 RETURNING *', [data.passwordHash, where.userId]))[0],
    },
    friendship: {
      findUnique: async ({ where }: { where: { userId_friendId: { userId: number; friendId: number } } }) => (await query('SELECT "userId" FROM "Friendship" WHERE "userId" = $1 AND "friendId" = $2', [where.userId_friendId.userId, where.userId_friendId.friendId]))[0] ?? null,
      deleteMany: async ({ where }: { where: { OR: { userId: number; friendId: number }[] } }) => ({ count: (await query('DELETE FROM "Friendship" WHERE ("userId" = $1 AND "friendId" = $2) OR ("userId" = $3 AND "friendId" = $4) RETURNING *', where.OR.flatMap((pair) => [pair.userId, pair.friendId]))).length }),
    },
    friendRequest: {
      deleteMany: async ({ where }: { where: { OR: { senderId: number; receiverId: number }[] } }) => {
        if (state.failFriendCleanup) throw new Error("private database failure");
        return { count: (await query('DELETE FROM "FriendRequest" WHERE ("senderId" = $1 AND "receiverId" = $2) OR ("senderId" = $3 AND "receiverId" = $4) RETURNING *', where.OR.flatMap((pair) => [pair.senderId, pair.receiverId]))).length };
      },
    },
    authSession: {
      create: async ({ data }: { data: { tokenHash: string; userId: number; expiresAt: Date } }) => {
        if (state.failSession) throw new Error("simulated session failure");
        return (await query('INSERT INTO "AuthSession" VALUES ($1, $2, $3) RETURNING *', [data.tokenHash, data.userId, data.expiresAt.toISOString()]))[0];
      },
      deleteMany: async ({ where }: { where: { tokenHash?: string; userId?: number } }) => {
        const rows = await query(`DELETE FROM "AuthSession" WHERE "${where.tokenHash ? "tokenHash" : "userId"}" = $1 RETURNING "tokenHash"`, [where.tokenHash ?? where.userId]);
        return { count: rows.length };
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const [row] = await query<{ expiresAt: Date; id: number; username: string; displayName: string }>('SELECT s."expiresAt", u."id", u."username", u."displayName" FROM "AuthSession" s JOIN "User" u ON u."id" = s."userId" WHERE s."tokenHash" = $1', [where.tokenHash]);
        return row ? { expiresAt: row.expiresAt, user: { id: row.id, username: row.username, displayName: row.displayName } } : null;
      },
    },
  };
}

beforeAll(async () => {
  const folder = resolve("prisma/postgres-migrations");
  for (const name of readdirSync(folder).sort()) {
    if (name.endsWith(".toml")) continue;
    await db.exec(readFileSync(resolve(folder, name, "migration.sql"), "utf8"));
  }
  Object.assign(state.prisma, api(db), { $transaction: (fn: (tx: ReturnType<typeof api>) => Promise<unknown>) => db.transaction((tx) => fn(api(tx))) });
}, 30_000);
beforeEach(async () => {
  vi.stubEnv("AUTH_MODE", "credentials"); vi.stubEnv("VERCEL", "");
  state.cookies.clear(); state.failSession = false; state.failFriendCleanup = false;
  await db.exec('TRUNCATE "User", "AuthAttempt" RESTART IDENTITY CASCADE');
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.close());
function credentials(password = "test-password") {
  const data = new FormData();
  Object.entries({ username: "new_user", displayName: "Test", email: "Test@Example.com", password, passwordConfirmation: password }).forEach(([key, value]) => data.set(key, value));
  return data;
}
it("logs a provisioned legacy owner into the same ID with all records and relationships preserved", async () => {
  await db.exec(`
    INSERT INTO "User" ("username", "displayName") VALUES ('legacy', 'Legacy'), ('friend', 'Friend');
    INSERT INTO "Anime" ("title", "rating", "userId", "isFeatured") VALUES ('Legacy favorite', 'SS', 1, true);
    INSERT INTO "Tag" ("name") VALUES ('Action');
    INSERT INTO "AnimeTag" ("animeId", "tagId") VALUES (1, 1);
    INSERT INTO "UserFavoriteGenre" VALUES (1, 'Action');
    INSERT INTO "Friendship" ("userId", "friendId") VALUES (1, 2), (2, 1);
    INSERT INTO "FriendRequest" ("senderId", "receiverId", "status") VALUES (2, 1, 'ACCEPTED');
  `);
  const tables = ["User", "Anime", "Tag", "AnimeTag", "UserFavoriteGenre", "Friendship", "FriendRequest"];
  const before = await Promise.all(tables.map(async (table) => (await db.query(`SELECT * FROM "${table}"`)).rows));
  await provisionLegacyOwner(db, { userId: "1", username: "legacy", email: "Test@Example.com", apply: true, ownerVerified: true, emailVerified: true, password: "test-password", passwordConfirmation: "test-password" });
  state.cookies.set("anime_record_user_id", "2");
  expect(await getCurrentUser()).toBeNull();
  await expect(signIn({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
  expect((await getCurrentUser())?.id).toBe(1);
  expect((await getCurrentUser())?.username).toBe("legacy");
  const after = await Promise.all(tables.map(async (table) => (await db.query(`SELECT * FROM "${table}"`)).rows));
  expect(after).toEqual(before);
}, 15_000);
it("registers, rotates sessions after a password change, rejects the old password, and logs out", async () => {
  await expect(signUp({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
  expect((await getCurrentUser())?.username).toBe("new_user");
  const signupToken = state.cookies.get(sessionCookieName)!;
  await expect(signIn({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
  const loginToken = state.cookies.get(sessionCookieName)!;
  expect(loginToken).not.toBe(signupToken);
  const change = new FormData(); change.set("currentPassword", "test-password"); change.set("password", "changed-password"); change.set("passwordConfirmation", "changed-password");
  await expect(changePassword({ message: "" }, change)).rejects.toThrow(/^REDIRECT \/users\/account\?changed=[0-9a-f-]{36}$/);
  const changedToken = state.cookies.get(sessionCookieName)!;
  expect(changedToken).not.toBe(loginToken);
  for (const old of [signupToken, loginToken]) {
    state.cookies.set(sessionCookieName, old);
    expect(await getCurrentUser()).toBeNull();
    expect((await db.query('SELECT * FROM "AuthSession" WHERE "tokenHash" = $1', [tokenDigest(old)])).rows).toHaveLength(0);
  }
  expect((await signIn({ message: "" }, credentials())).message).toContain("違います");
  await expect(signIn({ message: "" }, credentials("changed-password"))).rejects.toThrow("REDIRECT /anime");
  expect(await getCurrentUser()).not.toBeNull();
  await clearSession();
  expect(await getCurrentUser()).toBeNull();
  // Logout affects only the presented session; the password-change session still exists.
  state.cookies.set(sessionCookieName, changedToken);
  expect(await getCurrentUser()).not.toBeNull();
}, 20_000);

it("rolls back user and credential creation if the initial session cannot be created", async () => {
  state.failSession = true;
  expect((await signUp({ message: "" }, credentials())).message).toContain("利用できません");
  expect((await db.query('SELECT * FROM "User"')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect(state.cookies.size).toBe(0);
}, 10_000);

it("rolls back the password update and revocation when replacement session creation fails", async () => {
  await expect(signUp({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
  const oldToken = state.cookies.get(sessionCookieName)!;
  const oldCredential = (await db.query('SELECT "passwordHash" FROM "UserCredential"')).rows;
  const data = new FormData(); data.set("currentPassword", "test-password"); data.set("password", "changed-password"); data.set("passwordConfirmation", "changed-password");
  state.failSession = true;
  expect((await changePassword({ message: "" }, data)).message).toContain("変更できませんでした");
  expect(state.cookies.get(sessionCookieName)).toBe(oldToken);
  expect((await db.query('SELECT "passwordHash" FROM "UserCredential"')).rows).toEqual(oldCredential);
  expect((await db.query('SELECT "tokenHash" FROM "AuthSession"')).rows).toEqual([{ tokenHash: tokenDigest(oldToken) }]);
  expect(await getCurrentUser()).not.toBeNull();
  state.failSession = false;
  await expect(signIn({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
}, 10_000);

it("never attaches credentials to a legacy username or claims its anime records", async () => {
  await db.exec(`INSERT INTO "User" ("username", "displayName") VALUES ('new_user', 'Legacy'); INSERT INTO "Anime" ("title", "rating", "userId") VALUES ('Legacy anime', 'SS', 1)`);
  expect((await signUp({ message: "" }, credentials())).message).toContain("登録できません");
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect((await db.query('SELECT "title", "rating", "userId" FROM "Anime"')).rows).toEqual([{ title: "Legacy anime", rating: "SS", userId: 1 }]);
  expect(state.cookies.size).toBe(0);
}, 10_000);

it("rolls back a failed friend removal before a safe retry and preserves unrelated records", async () => {
  await expect(signUp({ message: "" }, credentials())).rejects.toThrow("REDIRECT /anime");
  await db.exec(`
    INSERT INTO "User" ("username", "displayName") VALUES ('friend_two', 'Two'), ('friend_three', 'Three');
    INSERT INTO "Friendship" ("userId", "friendId") VALUES (1, 2), (2, 1), (1, 3), (3, 1);
    INSERT INTO "FriendRequest" ("senderId", "receiverId", "status") VALUES (1, 2, 'ACCEPTED'), (2, 1, 'ACCEPTED'), (1, 3, 'ACCEPTED');
    INSERT INTO "Anime" ("title", "rating", "userId") VALUES ('Own anime', 'SS', 1), ('Friend anime', 'S', 2);
  `);
  state.cookies.set("anime_record_user_id", "3");
  state.failFriendCleanup = true;
  expect((await removeFriend("2")).message).toContain("ページを更新");
  expect((await db.query('SELECT * FROM "Friendship"')).rows).toHaveLength(4);
  expect((await db.query('SELECT * FROM "FriendRequest"')).rows).toHaveLength(3);
  state.failFriendCleanup = false;
  await expect(removeFriend("2")).rejects.toThrow("REDIRECT /users/search");
  expect((await db.query('SELECT "userId", "friendId" FROM "Friendship" ORDER BY "userId"')).rows).toEqual([{ userId: 1, friendId: 3 }, { userId: 3, friendId: 1 }]);
  expect((await db.query('SELECT "senderId", "receiverId" FROM "FriendRequest"')).rows).toEqual([{ senderId: 1, receiverId: 3 }]);
  expect((await db.query('SELECT "title", "rating", "userId" FROM "Anime" ORDER BY "id"')).rows).toEqual([{ title: "Own anime", rating: "SS", userId: 1 }, { title: "Friend anime", rating: "S", userId: 2 }]);
  await expect(removeFriend("2")).rejects.toThrow("REDIRECT /users/search");
  expect((await db.query('SELECT * FROM "Friendship"')).rows).toHaveLength(2);
}, 10_000);
