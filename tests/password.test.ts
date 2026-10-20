// @vitest-environment node
import { expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

it("uses random salts and verifies without accepting altered or unknown hashes", async () => {
  const password = "a long test password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  expect(first).not.toBe(second);
  expect(first).not.toContain(password);
  expect(await verifyPassword(password, first)).toBe(true);
  expect(await verifyPassword("different password", first)).toBe(false);
  expect(await verifyPassword(password, null)).toBe(false);
  expect(await verifyPassword(password, "malformed")).toBe(false);
}, 15_000);
