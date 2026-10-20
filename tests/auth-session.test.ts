// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), remove: vi.fn(), findUnique: vi.fn(), deleteMany: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get, set: mocks.set, delete: mocks.remove }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { authSession: { findUnique: mocks.findUnique, deleteMany: mocks.deleteMany } } }));
import { clearSession, getSessionUser, newSession, sessionCookieName, setSessionCookie, tokenDigest } from "@/lib/auth-session";
import { getCurrentUser } from "@/lib/current-user";
import { usesCredentialAuth, requireDemoMode } from "@/lib/auth-mode";

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("AUTH_MODE", "credentials"); vi.stubEnv("VERCEL", ""); });
afterEach(() => vi.unstubAllEnvs());
it("ignores legacy user IDs and malformed session cookies", async () => {
  mocks.get.mockImplementation((name) => name === "anime_record_user_id" ? { value: "1" } : undefined);
  expect(await getCurrentUser()).toBeNull();
  mocks.get.mockReturnValue({ value: "1" });
  expect(await getSessionUser()).toBeNull();
  expect(mocks.findUnique).not.toHaveBeenCalled();
});
it("stores a digest, rejects expired/revoked sessions, and returns the owner", async () => {
  const session = newSession(7);
  expect(session.token).toMatch(/^[a-f0-9]{64}$/);
  expect(session.data.tokenHash).not.toBe(session.token);
  mocks.get.mockReturnValue({ value: session.token });
  mocks.findUnique.mockResolvedValue({ ...session.data, user: { id: 7 } });
  expect(await getCurrentUser()).toEqual({ id: 7 });
  expect(mocks.findUnique).toHaveBeenCalledWith({ where: { tokenHash: tokenDigest(session.token) }, include: { user: true } });
  mocks.findUnique.mockResolvedValue({ ...session.data, expiresAt: new Date(0), user: { id: 7 } });
  expect(await getSessionUser()).toBeNull();
  mocks.findUnique.mockResolvedValue(null);
  expect(await getSessionUser()).toBeNull();
});
it("revokes only the presented session and clears the cookie", async () => {
  const session = newSession(7);
  mocks.get.mockReturnValue({ value: session.token });
  await clearSession();
  expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { tokenHash: session.data.tokenHash } });
  expect(mocks.remove).toHaveBeenCalledWith(sessionCookieName);
});
it("clears local cookies even when server-side session revocation fails", async () => {
  mocks.get.mockReturnValue({ value: "a".repeat(64) });
  mocks.deleteMany.mockRejectedValue(new Error("database unavailable"));
  await expect(clearSession()).rejects.toThrow("database unavailable");
  expect(mocks.remove).toHaveBeenCalledWith(sessionCookieName);
  expect(mocks.remove).toHaveBeenCalledWith("anime_record_user_id");
});
it("fails closed on a session database error without trusting a legacy ID", async () => {
  mocks.get.mockImplementation((name) => ({ value: name === sessionCookieName ? "a".repeat(64) : "1" }));
  mocks.findUnique.mockRejectedValue(new Error("database unavailable"));
  await expect(getCurrentUser()).rejects.toThrow("database unavailable");
});
it("uses secure HttpOnly cookies on Vercel and cannot enable demo login there", async () => {
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("AUTH_MODE", "demo");
  expect(usesCredentialAuth()).toBe(true);
  expect(() => requireDemoMode()).toThrow();
  await setSessionCookie("a".repeat(64));
  expect(mocks.set).toHaveBeenCalledWith(sessionCookieName, "a".repeat(64), expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", path: "/" }));
  expect(mocks.remove).toHaveBeenCalledWith("anime_record_user_id");
});
