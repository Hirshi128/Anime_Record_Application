import { expect, test } from "@playwright/test";

// No valid credential submissions: all errors occur before DB access.
test("credential forms fit the viewport and retain rejected signup input", async ({ page }, info) => {
  await page.goto("/users");
  await expect(page.getByRole("heading", { name: "ログイン・新規登録" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const signup = page.locator("section").filter({ has: page.getByRole("heading", { name: "新規登録", exact: true }) }).last();
  await signup.getByLabel("表示名", { exact: true }).fill("Test");
  await signup.getByLabel("ユーザーID", { exact: true }).fill("test_signup");
  await signup.getByLabel("メールアドレス", { exact: true }).fill("test@example.invalid");
  await signup.getByLabel("パスワード", { exact: true }).fill("test-password");
  await signup.getByLabel("パスワード（確認）", { exact: true }).fill("not-the-same-password");
  const toggle = signup.getByRole("button", { name: "パスワードを表示", exact: true });
  const bounds = (await toggle.boundingBox())!;
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(signup.getByLabel("パスワード", { exact: true })).toHaveAttribute("type", "text");
  await signup.getByRole("button", { name: "パスワードを隠す", exact: true }).click();
  const submit = signup.getByRole("button", { name: "登録してログイン", exact: true });
  expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(56);
  await submit.click();
  await expect(signup.getByRole("alert")).toContainText("一致");
  await expect(signup.getByLabel("メールアドレス", { exact: true })).toHaveValue("test@example.invalid");
  await expect(signup.getByLabel("パスワード", { exact: true })).toHaveValue("test-password");
  await expect(signup.getByLabel("パスワード", { exact: true })).toHaveAttribute("type", "password");
  await expect(page).toHaveURL(/\/users$/);
  await page.screenshot({ path: info.outputPath("credentials.png"), fullPage: true });
});

test("numeric user-ID and malformed session cookies cannot access protected pages", async ({ page, context }) => {
  await context.addCookies([
    { name: "anime_record_user_id", value: "1", url: "http://127.0.0.1:3031" },
    { name: "anime_record_session", value: "not-a-session", url: "http://127.0.0.1:3031" },
  ]);
  for (const path of ["/anime", "/anime/new", "/anime/new?title=Prefilled&userId=999&rating=SS", "/anime/insights", "/users/profile", "/users/search", "/users/account"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.getByRole("heading", { name: "ログイン・新規登録" })).toBeVisible();
  }
});

test("incomplete logout warning is readable on narrow screens", async ({ page }, info) => {
  await page.goto("/users?logout=partial");
  const warning = page.getByRole("main").getByRole("alert");
  await expect(warning).toContainText("この端末からログアウト");
  await expect(warning).toContainText("失効を確認できません");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await warning.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("logout-warning.png"), fullPage: true });
});
