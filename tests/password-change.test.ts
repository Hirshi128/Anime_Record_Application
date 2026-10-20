import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ owner: vi.fn(), allow: vi.fn(), credential: vi.fn(), update: vi.fn(), remove: vi.fn(), create: vi.fn(), lock: vi.fn(), cookie: vi.fn(), verify: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/current-user", () => ({ requireCurrentUser: m.owner }));
vi.mock("@/lib/auth-session", () => ({ allowAuthAttempt: m.allow, setSessionCookie: m.cookie, newSession: (userId: number) => ({ token: "new-token", data: { userId, tokenHash: "digest" } }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: async (fn: (tx: unknown) => unknown) => fn({ $queryRaw: m.lock, userCredential: { findUnique: m.credential, update: m.update }, authSession: { deleteMany: m.remove, create: m.create } }) } }));
vi.mock("@/lib/password", () => ({ hashPassword: m.hash, verifyPassword: m.verify }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { changePassword } from "@/app/users/account/actions";
import { parsePasswordChange } from "@/lib/auth-input";

function form() {
  const data = new FormData();
  data.set("currentPassword", "old-password"); data.set("password", "new-password"); data.set("passwordConfirmation", "new-password");
  return data;
}
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_MODE", "credentials");
  m.owner.mockResolvedValue({ id: 7 }); m.allow.mockResolvedValue(true);
  m.credential.mockResolvedValue({ userId: 7, passwordHash: "old-hash" });
  m.verify.mockResolvedValue(true); m.hash.mockResolvedValue("new-hash");
});
afterEach(() => vi.unstubAllEnvs());

it("requires an authenticated owner before processing or changing credentials", async () => {
  m.owner.mockRejectedValue(new Error("REDIRECT /users"));
  await expect(changePassword({ message: "" }, form())).rejects.toThrow("/users");
  expect(m.allow).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it("serializes verification, changes only the current owner, and revokes all old sessions atomically", async () => {
  await expect(changePassword({ message: "" }, form())).rejects.toThrow(/\/users\/account\?changed=[0-9a-f-]{36}$/);
  expect(m.credential).toHaveBeenCalledWith({ where: { userId: 7 } });
  expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.credential.mock.invocationCallOrder[0]);
  expect(m.verify).toHaveBeenCalledWith("old-password", "old-hash");
  expect(m.update).toHaveBeenCalledWith({ where: { userId: 7 }, data: { passwordHash: "new-hash" } });
  expect(m.remove).toHaveBeenCalledWith({ where: { userId: 7 } });
  expect(m.create).toHaveBeenCalledWith({ data: { userId: 7, tokenHash: "digest" } });
  expect(m.remove.mock.invocationCallOrder[0]).toBeLessThan(m.create.mock.invocationCallOrder[0]);
  expect(m.cookie).toHaveBeenCalledWith("new-token");
});
it("rejects a wrong current password without updates or session deletion", async () => {
  m.verify.mockResolvedValue(false);
  expect((await changePassword({ message: "" }, form())).message).toContain("現在のパスワードが違います");
  expect(m.update).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled(); expect(m.cookie).not.toHaveBeenCalled();
});
it("uses a fresh non-secret completion URL for repeated successful changes", async () => {
  const urls: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try { await changePassword({ message: "" }, form()); }
    catch (error) { urls.push((error as Error).message); }
  }
  expect(urls).toHaveLength(2);
  expect(urls[0]).not.toBe(urls[1]);
  for (const url of urls) {
    expect(url).toMatch(/^REDIRECT \/users\/account\?changed=[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(url).not.toMatch(/old-password|new-password|new-token|digest/);
  }
});
it("throttles password changes before password derivation", async () => {
  m.allow.mockResolvedValue(false);
  expect((await changePassword({ message: "" }, form())).message).toContain("15分");
  expect(m.credential).not.toHaveBeenCalled(); expect(m.verify).not.toHaveBeenCalled();
});
it("does not set a cookie when transactional session creation fails", async () => {
  m.create.mockRejectedValue(new Error("private details"));
  expect((await changePassword({ message: "" }, form())).message).not.toContain("private");
  expect(m.cookie).not.toHaveBeenCalled();
});
it("rejects short, mismatching, and unchanged new passwords", () => {
  const data = form(); data.set("password", "short"); expect(parsePasswordChange(data).error).toBeTruthy();
  data.set("password", "old-password"); data.set("passwordConfirmation", "old-password"); expect(parsePasswordChange(data).error).toContain("異なる");
  data.set("password", "different-password"); expect(parsePasswordChange(data).error).toContain("一致");
});
