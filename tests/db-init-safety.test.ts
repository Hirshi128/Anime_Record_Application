// @vitest-environment node
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("rejects PostgreSQL initialization before writes without logging the connection secret", () => {
  const result = spawnSync(process.execPath, ["scripts/init-db.mjs"], {
    encoding: "utf8",
    env: { ...process.env, DATABASE_URL: "postgresql://test:test-secret-never-print@invalid.example/test" },
    timeout: 10_000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status).not.toBe(0);
  const output = result.stdout + result.stderr;
  expect(output).toContain("Only SQLite file URLs are supported");
  expect(output).not.toContain("test-secret-never-print");
  expect(output).not.toContain("invalid.example");
  expect(output).not.toContain("postgresql://");
});
