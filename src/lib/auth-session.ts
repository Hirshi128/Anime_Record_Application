import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const sessionCookieName = "anime_record_session";
const sessionLifetime = 60 * 60 * 24 * 14;
export const tokenDigest = (value: string) => createHash("sha256").update(value).digest("hex");
export const isSessionToken = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

export function newSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  return { token, data: { tokenHash: tokenDigest(token), userId, expiresAt: new Date(Date.now() + sessionLifetime * 1000) } };
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.VERCEL === "1" || (process.env.NODE_ENV === "production" && process.env.AUTH_MODE !== "demo"),
    sameSite: "lax", path: "/", maxAge: sessionLifetime,
  });
  store.delete("anime_record_user_id");
}

export async function getSessionUser() {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!isSessionToken(token)) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: tokenDigest(token) }, include: { user: true } });
  return session && session.expiresAt > new Date() ? session.user : null;
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(sessionCookieName)?.value;
  try {
    if (isSessionToken(token)) await prisma.authSession.deleteMany({ where: { tokenHash: tokenDigest(token) } });
  } finally {
    store.delete(sessionCookieName);
    store.delete("anime_record_user_id");
  }
}

export async function allowAuthAttempt(identifier: string, purpose: "login" | "signup" | "password" | "friend-request", limit: number) {
  const key = tokenDigest(`${purpose}:${identifier}`);
  // A single atomic upsert also throttles simultaneous requests across instances.
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "AuthAttempt" ("key", "count", "expiresAt") VALUES (${key}, 1, (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') + INTERVAL '15 minutes')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "AuthAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN 1 ELSE "AuthAttempt"."count" + 1 END,
      "expiresAt" = CASE WHEN "AuthAttempt"."expiresAt" <= (CURRENT_TIMESTAMP AT TIME ZONE 'UTC') THEN EXCLUDED."expiresAt" ELSE "AuthAttempt"."expiresAt" END
    RETURNING "count"`;
  return rows[0]?.count <= limit;
}
