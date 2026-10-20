import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ credential: vi.fn(), session: vi.fn(), userCreate: vi.fn(), transaction: vi.fn(), lock: vi.fn(), allow: vi.fn(), cookie: vi.fn(), verify: vi.fn(), hash: vi.fn(), redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { userCredential: { findUnique: m.credential }, authSession: { create: m.session }, $transaction: m.transaction } }));
vi.mock("@/lib/auth-session", () => ({ allowAuthAttempt: m.allow, setSessionCookie: m.cookie, newSession: (userId: number) => ({ token: "test-session", data: { userId, tokenHash: "digest", expiresAt: new Date() } }) }));
vi.mock("@/lib/password", () => ({ hashPassword: m.hash, verifyPassword: m.verify }));
vi.mock("next/navigation", () => ({ redirect: m.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { signIn, signUp } from "@/app/users/auth-actions";
const form = () => {
  const data = new FormData();
  Object.entries({ email: "test@example.com", password: "test-password", passwordConfirmation: "test-password", displayName: "Test", username: "test_user" }).forEach(([key, value]) => data.set(key, value));
  return data;
};
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("AUTH_MODE", "credentials");
  m.allow.mockResolvedValue(true); m.verify.mockResolvedValue(true); m.hash.mockResolvedValue("hash");
  m.credential.mockResolvedValue({ userId: 7, email: "test@example.com", passwordHash: "hash" });
  m.userCreate.mockResolvedValue({ id: 8 });
  m.transaction.mockImplementation((fn) => fn({ user: { create: m.userCreate }, userCredential: { findUnique: m.credential }, authSession: { create: m.session }, $queryRaw: m.lock }));
  m.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
});
afterEach(() => vi.unstubAllEnvs());
describe("credential actions", () => {
  it.each([["displayName", 101], ["username", 65]] as const)("rejects oversized %s before hashing or DB access", async (field, size) => {
    const data = form(); data.set(field, "a".repeat(size));
    expect((await signUp({ message: "" }, data)).message).toContain("文字");
    expect(m.allow).not.toHaveBeenCalled();
    expect(m.hash).not.toHaveBeenCalled();
    expect(m.userCreate).not.toHaveBeenCalled();
  });
  it("creates a session only for a verified password", async () => {
    await expect(signIn({ message: "" }, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(m.session).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 7 }) });
    expect(m.cookie).toHaveBeenCalledWith("test-session");
    expect(m.lock.mock.invocationCallOrder[0]).toBeLessThan(m.verify.mock.invocationCallOrder[0]);
  });
  it("checks the current password hash under the user lock", async () => {
    m.credential.mockResolvedValueOnce({ userId: 7, email: "test@example.com", passwordHash: "old" }).mockResolvedValueOnce({ userId: 7, email: "test@example.com", passwordHash: "new" });
    m.verify.mockResolvedValue(false);
    await signIn({ message: "" }, form());
    expect(m.verify).toHaveBeenCalledWith("test-password", "new");
    expect(m.session).not.toHaveBeenCalled();
  });
  it("uses the same failure for absent accounts and wrong passwords", async () => {
    m.verify.mockResolvedValue(false);
    const wrong = await signIn({ message: "" }, form());
    m.credential.mockResolvedValue(null);
    const absent = await signIn({ message: "" }, form());
    expect(absent).toEqual(wrong);
    expect(m.verify).toHaveBeenLastCalledWith("test-password", null);
    expect(m.session).not.toHaveBeenCalled();
  });
  it("blocks throttled attempts before credential lookup or hashing", async () => {
    m.allow.mockResolvedValue(false);
    expect((await signIn({ message: "" }, form())).message).toContain("15分");
    expect((await signUp({ message: "" }, form())).message).toContain("15分");
    expect(m.credential).not.toHaveBeenCalled();
    expect(m.hash).not.toHaveBeenCalled();
  });
  it("registers a new owner atomically without claiming an existing user", async () => {
    await expect(signUp({ message: "" }, form())).rejects.toThrow("NEXT_REDIRECT");
    expect(m.userCreate).toHaveBeenCalledWith({ data: { displayName: "Test", username: "test_user", credential: { create: { email: "test@example.com", passwordHash: "hash" } } }, select: { id: true } });
    expect(m.session).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: 8 }) });
  });
  it("does not attach an existing username after a uniqueness conflict", async () => {
    m.userCreate.mockRejectedValue({ code: "P2002" });
    expect((await signUp({ message: "" }, form())).message).toContain("登録できません");
    expect(m.cookie).not.toHaveBeenCalled();
    expect(m.session).not.toHaveBeenCalled();
  });
  it("does not leak database failure details", async () => {
    m.allow.mockRejectedValue(new Error("private database error"));
    expect((await signIn({ message: "" }, form())).message).not.toContain("private");
    expect(m.cookie).not.toHaveBeenCalled();
  });
});
