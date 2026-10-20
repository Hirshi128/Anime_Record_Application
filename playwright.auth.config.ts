import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: "**/credentials.spec.ts",
  use: { ...base.use, baseURL: "http://127.0.0.1:3031" },
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3031",
    url: "http://127.0.0.1:3031/users",
    env: { AUTH_MODE: "credentials" },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
