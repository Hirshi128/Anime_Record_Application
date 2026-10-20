import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const client = { anime: { findMany: vi.fn() }, $disconnect: vi.fn(function (this: unknown) { return this; }) };
  return { client, adapter: vi.fn(), construct: vi.fn() };
});
vi.mock("@prisma/adapter-neon", () => ({ PrismaNeon: class { constructor(options: unknown) { mocks.adapter(options); } } }));
vi.mock("@/generated/prisma/client", () => ({ PrismaClient: class { constructor(options: unknown) { mocks.construct(options); return mocks.client; } } }));

const globalClient = globalThis as unknown as { prisma?: unknown };
beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); delete globalClient.prisma; });
afterEach(() => { vi.unstubAllEnvs(); delete globalClient.prisma; });

it("can import legacy DB modules without DATABASE_URL during a personal-app build", async () => {
  vi.stubEnv("DATABASE_URL", "");
  await expect(import("@/lib/prisma")).resolves.toHaveProperty("prisma");
  expect(mocks.adapter).not.toHaveBeenCalled();
  expect(mocks.construct).not.toHaveBeenCalled();
});

it("still refuses an actual DB operation without configuration", async () => {
  vi.stubEnv("DATABASE_URL", "");
  const { prisma } = await import("@/lib/prisma");
  expect(() => prisma.anime.findMany()).toThrow("DATABASE_URL is required.");
  expect(mocks.construct).not.toHaveBeenCalled();
});

it("constructs one client on first use and binds its methods to that client", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/isolated_test");
  const { prisma } = await import("@/lib/prisma");
  expect(mocks.construct).not.toHaveBeenCalled();
  prisma.anime.findMany();
  expect(prisma.$disconnect()).toBe(mocks.client);
  expect(mocks.construct).toHaveBeenCalledTimes(1);
  expect(mocks.adapter).toHaveBeenCalledTimes(1);
  expect(mocks.client.anime.findMany).toHaveBeenCalledTimes(1);
});

it("reuses the existing development client without constructing another pool", async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@127.0.0.1:5432/isolated_test");
  globalClient.prisma = mocks.client;
  const { prisma } = await import("@/lib/prisma");
  prisma.anime.findMany();
  expect(mocks.adapter).not.toHaveBeenCalled();
  expect(mocks.construct).not.toHaveBeenCalled();
});
