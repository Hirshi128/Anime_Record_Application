import { expect, test } from "@playwright/test";

test("home prioritizes the two main actions above compact feature cards", async ({ page }, testInfo) => {
  await page.goto("/");
  const mainActions = page.getByRole("navigation", { name: "メインメニュー" });
  const links = mainActions.getByRole("link");
  await expect(links).toHaveCount(2);
  for (const link of await links.all()) {
    await expect(link).toBeInViewport();
    const bounds = await link.boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(88);
    expect(bounds?.width).toBeGreaterThanOrEqual(280);
  }
  const primaryHeight = (await links.first().boundingBox())!.height;
  for (const card of await page.locator(".home-feature").all()) {
    expect((await card.boundingBox())!.height).toBeLessThan(primaryHeight);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press("Tab");
  await expect(links.first()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(links.nth(1)).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("user selection reading, visual, and keyboard order agree", async ({ page }, testInfo) => {
  await page.goto("/users");
  const buttons = page.getByRole("button", { name: "ログイン", exact: true });
  if (!(await buttons.count())) test.skip(true, "No existing user to inspect");
  const firstButton = buttons.first();
  const registration = page.getByRole("textbox", { name: "表示名" });
  const loginSection = firstButton.locator("xpath=ancestor::section[1]");
  const registrationSection = registration.locator("xpath=ancestor::section[1]");
  const loginBounds = (await loginSection.boundingBox())!;
  const registrationBounds = (await registrationSection.boundingBox())!;
  if (testInfo.project.name === "desktop") {
    expect(loginBounds.x).toBeLessThan(registrationBounds.x);
  } else {
    expect(loginBounds.y).toBeLessThan(registrationBounds.y);
  }
  await page.getByRole("link", { name: "ホームへ戻る" }).focus();
  await page.keyboard.press("Tab");
  await expect(firstButton).toBeFocused();
  expect((await firstButton.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("users.png"), fullPage: true });
});
