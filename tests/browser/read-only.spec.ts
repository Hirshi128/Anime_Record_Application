import { expect, test } from "@playwright/test";

// These checks read existing records. They never create users, records, or friendships.
test.beforeEach(async ({ page }) => {
  await page.goto("/users");
  await page
    .getByRole("button", { name: "ログイン", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/anime$/);
});

test("main screens fit the viewport and keep important commands large", async ({
  page,
}, testInfo) => {
  for (const [name, path] of [
    ["list", "/anime"],
    ["registration", "/anime/new"],
    ["profile", "/users/profile"],
    ["friends", "/users/search"],
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    if (name === "list") {
      expect((await page.getByText("AND", { exact: true }).boundingBox())!.height).toBeLessThanOrEqual(48);
    }
    if (name === "friends") {
      const back = (await page.getByRole("link", { name: "アニメ一覧へ戻る" }).boundingBox())!;
      const eyebrow = (await page.locator("header .eyebrow").boundingBox())!;
      expect(eyebrow.y).toBeGreaterThanOrEqual(back.y + back.height + 16);
    }
    const primaryCommands = page.locator(".button-primary.button-large");
    expect(await primaryCommands.count()).toBeGreaterThan(0);
    for (const command of await primaryCommands.all()) {
      await expect(command).toBeVisible();
      const bounds = (await command.boundingBox())!;
      expect(bounds.height).toBeGreaterThanOrEqual(56);
      expect(bounds.width).toBeGreaterThanOrEqual(180);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      expect(await command.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
    });
  }
});

test("insights and notification refresh fit the viewport without losing search context", async ({ page }, testInfo) => {
  await page.goto("/anime/insights");
  if (!await page.getByRole("meter").count()) {
    await page.goto("/users");
    const ids = await page.locator('input[name="userId"]').evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    for (const id of ids.slice(1, 8)) {
      await page.goto("/users");
      await page.locator("form").filter({ has: page.locator(`input[name="userId"][value="${id}"]`) }).getByRole("button", { name: "ログイン", exact: true }).click();
      await expect(page).toHaveURL(/\/anime$/);
      await page.goto("/anime/insights");
      if (await page.getByRole("meter").count()) break;
    }
    if (!await page.getByRole("meter").count()) await page.goto("/anime/insights");
  }
  await expect(page.getByRole("heading", { name: "好みの傾向", exact: true })).toBeVisible();
  const recommendations = page.locator("section").filter({ has: page.getByRole("heading", { name: "フレンドからのおすすめ", exact: true }) }).last();
  await expect(recommendations).toBeVisible();
  expect(await recommendations.locator("article").count()).toBeLessThanOrEqual(6);
  for (const card of await recommendations.locator("article").all()) {
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(card.locator('a[href^="/users/search?"]')).toHaveAttribute("href", /^\/users\/search\?q=/);
    await expect(card.getByRole("link", { name: "記録する", exact: true })).toHaveAttribute("href", /^\/anime\/new(?:\?title=|$)/);
  }
  const back = (await page.getByRole("link", { name: "アニメ一覧へ戻る" }).boundingBox())!;
  expect((await page.locator("header .eyebrow").boundingBox())!.y).toBeGreaterThanOrEqual(back.y + back.height + 16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const meter of await page.getByRole("meter").all()) {
    const bounds = (await meter.boundingBox())!;
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await expect(meter).toHaveAttribute("aria-valuetext", /作品/);
  }
  await page.screenshot({ path: testInfo.outputPath("insights.png"), fullPage: true });
  await page.goto("/users/search?q=anime");
  const refresh = page.getByRole("button", { name: "通知を更新" });
  const bounds = (await refresh.boundingBox())!;
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  await refresh.click();
  await expect(refresh).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "ユーザー検索", exact: true }).or(page.getByRole("searchbox", { name: "ユーザー検索", exact: true }))).toHaveValue("anime");
  await expect(page).toHaveURL(/q=anime/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("notification-refresh.png"), fullPage: true });
});

test("a recommendation title opens a personal draft without copying rating or saving", async ({ page }, info) => {
  const title = "おすすめ & 作品名?rating=SS#example";
  const posts: string[] = [];
  page.on("request", (request) => { if (request.method() === "POST") posts.push(request.url()); });
  await page.goto(`/anime/new?${new URLSearchParams({ title, rating: "SS", status: "COMPLETED", userId: "999" })}`);
  await expect(page.getByRole("combobox", { name: "タイトル" })).toHaveValue(title);
  await expect(page.getByRole("combobox", { name: "評価", exact: true })).toHaveValue("A");
  await expect(page.getByRole("combobox", { name: "視聴状況", exact: true })).toHaveValue("WATCHING");
  await expect(page.getByRole("textbox", { name: "感想" })).toHaveValue("");
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("recommendation-draft.png"), fullPage: true });
});

test("title suggestions scroll and support keyboard selection", async ({
  page,
}, testInfo) => {
  await page.route("**/api/anime-title-suggestions?*", (route) =>
    route.fulfill({
      json: {
        suggestions: Array.from({ length: 12 }, (_, index) => ({
          id: index + 1,
          title: `候補作品 ${index + 1}`,
          subtitle: "2026 / TV",
        })),
      },
    }),
  );
  await page.goto("/anime/new");
  const input = page.getByRole("combobox", { name: "タイトル" });
  await input.fill("候補");
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  expect(
    await listbox.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  const bounds = await listbox.boundingBox();
  if (!bounds) throw new Error("Missing suggestion list");
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.wheel(0, 800);
  await expect
    .poll(() => listbox.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  await input.press("ArrowUp");
  await expect(input).toHaveAttribute("aria-activedescendant", /-11$/);
  await input.press("Enter");
  await expect(input).toHaveValue("候補作品 12");
  await expect(listbox).toHaveCount(0);
  await expect(page).toHaveURL(/\/anime\/new$/);
  await page.screenshot({
    path: testInfo.outputPath("new-record.png"),
    fullPage: true,
  });
});

test("deletion can be cancelled and pending labels keep their size without a server mutation", async ({
  page,
}, testInfo) => {
  let record = page.locator("a.record-card").first();
  if ((await record.count()) === 0) {
    await page.goto("/users");
    const userIds = await page
      .locator('input[name="userId"]')
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
    for (const id of userIds.slice(1)) {
      await page.goto("/users");
      await page
        .locator("form")
        .filter({ has: page.locator(`input[name="userId"][value="${id}"]`) })
        .getByRole("button", { name: "ログイン", exact: true })
        .click();
      await expect(page).toHaveURL(/\/anime$/);
      record = page.locator("a.record-card").first();
      if ((await record.count()) > 0) break;
    }
  }
  if ((await record.count()) === 0)
    test.skip(true, "No existing record to inspect");
  await record.click();
  let mutationCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST") mutationCount++;
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "削除", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "更新", exact: true }),
  ).toBeVisible();
  expect(mutationCount).toBe(0);

  // Hold the request in the browser; it must never reach the production database.
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => { release = resolve; });
  let intercepted = 0;
  await page.route("**/*", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    intercepted++;
    await blocked;
    await route.abort();
  });
  const deleteButton = page.getByRole("button", { name: "削除", exact: true });
  const initialBounds = (await deleteButton.boundingBox())!;
  page.once("dialog", (dialog) => dialog.accept());
  try {
    await deleteButton.click();
    const pendingButton = page.getByRole("button", { name: "削除中...", exact: true });
    await expect(pendingButton).toBeDisabled();
    await expect.poll(() => intercepted).toBe(1);
    const pendingBounds = (await pendingButton.boundingBox())!;
    expect(pendingBounds.width).toBeCloseTo(initialBounds.width, 0);
    expect(pendingBounds.height).toBeCloseTo(initialBounds.height, 0);
    expect(pendingBounds.x).toBeCloseTo(initialBounds.x, 0);
    await page.screenshot({ path: testInfo.outputPath("pending-delete.png") });
  } finally {
    release();
  }
});

test("long titles and genre labels fit narrow screens", async ({
  page,
}, testInfo) => {
  await page.goto("/anime/new");
  await page.locator("h1").evaluate((heading) => {
    heading.textContent = "VeryLongAnimeTitle".repeat(8);
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const overflows = await page.locator(".choice-tile").evaluateAll(
    (tiles) =>
      tiles.filter((tile) => {
        const text = tile.querySelector("span");
        if (!text) return false;
        const textBox = text.getBoundingClientRect();
        const tileBox = tile.getBoundingClientRect();
        return (
          textBox.right > tileBox.right + 1 ||
          textBox.bottom > tileBox.bottom + 1
        );
      }).length,
  );
  expect(overflows).toBe(0);
  await page.screenshot({
    path: testInfo.outputPath("long-title.png"),
    fullPage: true,
  });
});

test("invalid submission preserves the entire record form without writing a record", async ({
  page,
}) => {
  await page.goto("/anime/new");
  await page.getByRole("combobox", { name: "タイトル" }).fill("   ");
  await page
    .getByRole("combobox", { name: "評価", exact: true })
    .selectOption("S");
  await page
    .getByRole("combobox", { name: "視聴状況" })
    .selectOption("COMPLETED");
  await page.getByRole("checkbox", { name: "SF", exact: true }).check();
  await page
    .getByRole("textbox", { name: "感想" })
    .fill("保存されない検証用入力");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "タイトルは必須です。",
  );
  await expect(
    page.getByRole("combobox", { name: "評価", exact: true }),
  ).toHaveValue("S");
  await expect(page.getByRole("combobox", { name: "視聴状況" })).toHaveValue(
    "COMPLETED",
  );
  await expect(
    page.getByRole("checkbox", { name: "SF", exact: true }),
  ).toBeChecked();
  await expect(page.getByRole("textbox", { name: "感想" })).toHaveValue(
    "保存されない検証用入力",
  );
  await expect(page).toHaveURL(/\/anime\/new$/);
});

test("offline launch shows a fallback and retries the original page", async ({
  page,
  context,
}, testInfo) => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const cachedPaths = await page.evaluate(async () => {
    const cache = await caches.open("anime-record-offline-v1");
    return (await cache.keys())
      .map((request) => new URL(request.url).pathname)
      .sort();
  });
  expect(cachedPaths).toEqual(["/icons/icon-192.png", "/offline.html"]);
  await context.setOffline(true);
  await page.goto("/anime/new");
  await expect(
    page.getByRole("heading", { name: "オフラインです" }),
  ).toBeVisible();
  expect(
    await page
      .locator("img")
      .evaluate((img) => (img as HTMLImageElement).naturalWidth > 0),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("offline.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.getByRole("button", { name: "再試行" }).click();
  await expect(page.getByRole("heading", { name: "アニメ登録" })).toBeVisible();
  await expect(page).toHaveURL(/\/anime\/new$/);
});
