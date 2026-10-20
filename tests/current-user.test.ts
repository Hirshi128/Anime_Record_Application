import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { getCookie, findUnique } = vi.hoisted(() => ({
  getCookie: vi.fn(),
  findUnique: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));
import { getCurrentUser } from "@/lib/current-user";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("AUTH_MODE", "demo");
  vi.stubEnv("VERCEL", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("current user ID validation", () => {
  it.each([
    undefined,
    "",
    "0",
    "-1",
    "01",
    "1e2",
    "1.5",
    "2147483648",
    "999999999999999999999",
    "invalid",
  ])("does not query Prisma for %s", async (value) => {
    getCookie.mockReturnValue(value === undefined ? undefined : { value });
    expect(await getCurrentUser()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
  it("looks up a valid existing user", async () => {
    getCookie.mockReturnValue({ value: "1" });
    findUnique.mockResolvedValue({ id: 1 });
    expect(await getCurrentUser()).toEqual({ id: 1 });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
