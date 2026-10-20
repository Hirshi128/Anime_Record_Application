// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { parseOwner, provisionLegacyOwner } from "../scripts/legacy-credentials.mjs";
import { verifyPassword } from "@/lib/password";

const db = new PGlite();
const owner = { userId: "1", username: "legacy", email: " Owner@Example.com ", apply: true, ownerVerified: true, emailVerified: true, password: "owner-password", passwordConfirmation: "owner-password" };
beforeAll(async () => {
  const folder = resolve("prisma/postgres-migrations");
  for (const name of readdirSync(folder).sort().filter((name) => !name.endsWith(".toml"))) {
    await db.exec(readFileSync(resolve(folder, name, "migration.sql"), "utf8"));
  }
}, 30_000);
beforeEach(async () => {
  await db.exec(`TRUNCATE "User" RESTART IDENTITY CASCADE;
    INSERT INTO "User" ("username", "displayName") VALUES ('legacy', 'Legacy'), ('other', 'Other');
    INSERT INTO "AuthSession" VALUES ('old-own', 1, '2030-01-01'), ('other-session', 2, '2030-01-01');`);
});
afterAll(() => db.close());

it("defaults to a read-only check, then provisions once without resetting credentials", async () => {
  expect(await provisionLegacyOwner(db, { ...owner, apply: false })).toEqual({ applied: false, userId: 1 });
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM "AuthSession"')).rows).toHaveLength(2);
  await provisionLegacyOwner(db, owner);
  const rows = (await db.query<{ email: string; passwordHash: string }>('SELECT * FROM "UserCredential"')).rows;
  expect(rows[0].email).toBe("owner@example.com");
  expect(await verifyPassword(owner.password, rows[0].passwordHash)).toBe(true);
  expect((await db.query('SELECT "tokenHash" FROM "AuthSession"')).rows).toEqual([{ tokenHash: "other-session" }]);
  await expect(provisionLegacyOwner(db, owner)).rejects.toThrow("already has credentials");
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toEqual(rows);
}, 15_000);

it.each([
  { userId: "2" }, { username: "wrong" }, { userId: "999" },
  { ownerVerified: false }, { emailVerified: false },
  { password: "short", passwordConfirmation: "short" }, { passwordConfirmation: "different-password" },
])("rejects unsafe owner or password changes: %j", async (change) => {
  await expect(provisionLegacyOwner(db, { ...owner, ...change })).rejects.toThrow();
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM "AuthSession"')).rows).toHaveLength(2);
}, 10_000);

it("rejects an email belonging to another account, including mixed case", async () => {
  await db.query('INSERT INTO "UserCredential" VALUES (2, $1, $2)', ["Owner@Example.com", "untouched"]);
  await expect(provisionLegacyOwner(db, owner)).rejects.toThrow("email is in use");
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toEqual([{ userId: 2, email: "Owner@Example.com", passwordHash: "untouched" }]);
}, 10_000);

it("rolls back credentials if session revocation fails", async () => {
  const connection = { query: async (sql: string, values?: unknown[]) => {
    if (sql.startsWith('DELETE FROM "AuthSession"')) throw new Error("simulated failure");
    return db.query(sql, values);
  } };
  await expect(provisionLegacyOwner(connection, owner)).rejects.toThrow("simulated failure");
  expect((await db.query('SELECT * FROM "UserCredential"')).rows).toHaveLength(0);
  expect((await db.query('SELECT * FROM "AuthSession"')).rows).toHaveLength(2);
}, 10_000);

it("validates IDs and email without imposing new signup username limits on legacy names", () => {
  expect(parseOwner({ ...owner, username: "a".repeat(100) }).username).toHaveLength(100);
  for (const userId of ["0", "-1", "1 OR 1=1", "2147483648"]) expect(() => parseOwner({ ...owner, userId })).toThrow();
  expect(() => parseOwner({ ...owner, email: "not-email" })).toThrow();
});

it.each([
  ["--password", "secret-password"],
  ["--user-id", "1", "--username", "legacy", "--email", "owner@example.com"],
  ["--user-id", "1", "--username", "legacy", "--email", "owner@example.com", "--apply"],
  ["--user-id", "1", "--username", "legacy", "--email", "owner@example.com", "--apply", "--owner-verified", "--email-verified"],
])("CLI refuses unsafe setup without connecting or leaking credentials: %j", (...args) => {
  const result = spawnSync(process.execPath, [resolve("scripts/provision-legacy-user.mjs"), ...args], {
    encoding: "utf8", env: { ...process.env, LEGACY_SETUP_DATABASE_URL: "", DATABASE_URL: "postgresql://user:secret-password@private-host/db" },
  });
  expect(result.status).toBe(1);
  const output = result.stdout + result.stderr;
  expect(output).not.toContain("secret-password");
  expect(output).not.toContain("private-host");
});
