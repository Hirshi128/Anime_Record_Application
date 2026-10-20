import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/personal.spec.ts",
  testIgnore: "**/credentials.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3030", channel: process.platform === "win32" ? "msedge" : undefined, headless: true },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    {
      name: "android-size",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "android-compact",
      use: {
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
