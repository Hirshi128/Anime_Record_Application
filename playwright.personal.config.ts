import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base, testIgnore: [], testMatch: "**/personal.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3031", acceptDownloads: true, screenshot: "only-on-failure" },
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3031", url: "http://127.0.0.1:3031/", reuseExistingServer: false, timeout: 60000 },
});
