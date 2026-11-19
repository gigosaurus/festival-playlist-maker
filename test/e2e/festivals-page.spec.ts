import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures.ts";

test.beforeEach(async ({ logIn }) => {
  await logIn();
});

test("the Festivals page shows its empty state when no festival is published", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Festivals – Festival Playlist Maker");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Festivals");
  await expect(page.getByRole("heading", { name: "There are no published festivals" })).toBeVisible();
  await expect(page.getByText("A festival shows here when the admin publishes it.")).toBeVisible();
});

test("the Festivals page sends no outbound request through the HTTP client", async ({ page, testServer }) => {
  const afterLogIn = (await testServer.sentHttpRequests()).length;

  await page.goto("/");

  expect(await testServer.sentHttpRequests()).toHaveLength(afterLogIn);
});

test("the test server runs the application with a fake clock that tests can set", async ({ testServer }) => {
  // publish-festival.spec.ts uses this route for the order of complete festivals.
  await testServer.setTime(new Date("2027-06-12T10:00:00Z"));

  expect(await testServer.time()).toEqual(new Date("2027-06-12T10:00:00Z"));
});

test("an unknown address shows the Page not found page with status 404", async ({ page }) => {
  const response = await page.goto("/no-such-page");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  await page.getByRole("link", { name: "Show the festivals" }).click();
  await expect(page).toHaveURL("/");
});

test("the wordmark goes to the Festivals page and has a visible focus indicator", async ({ page }) => {
  await page.goto("/no-such-page");

  await page.keyboard.press("Tab");
  const wordmark = page.getByRole("link", { name: "Festival Playlist Maker" });
  await expect(wordmark).toBeFocused();
  await expect(wordmark).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
});

for (const path of ["/", "/no-such-page"]) {
  test(`${path} has no WCAG 2.2 AA violations that axe can find`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}
