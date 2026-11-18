import AxeBuilder from "@axe-core/playwright";
import { spotifyProfileUrl, spotifyTokenUrl } from "../../src/spotify-log-in.ts";
import { expect, test, testAdmin, testUser } from "./fixtures.ts";

test("a person who is not logged in sees the Log in page", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL("/log-in");
  await expect(page).toHaveTitle("Log in – Festival Playlist Maker");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Log in");
  await expect(page.getByRole("button", { name: "Log in with Spotify" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
});

test("a user on the allowlist logs in with Spotify and then sees the Festivals page", async ({
  page,
  spotify,
  testServer,
}) => {
  await spotify.willLogIn(testUser);
  await spotify.answerAuthorisation("agree");
  await page.goto("/");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Festivals");
  await expect(page.locator("header")).toContainText("Alex Example");
  const requests = await testServer.sentHttpRequests();
  expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
    `POST ${spotifyTokenUrl}`,
    `GET ${spotifyProfileUrl}`,
  ]);
  expect(new URLSearchParams(requests[0]!.body).get("code")).toBe("fake-authorisation-code");
});

test("after the log in, the user sees the page that they first opened", async ({ page, spotify }) => {
  await spotify.willLogIn(testUser);
  await spotify.answerAuthorisation("agree");
  await page.goto("/no-such-page?from=bookmark");
  await expect(page).toHaveURL("/log-in?next=%2Fno-such-page%3Ffrom%3Dbookmark");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/no-such-page?from=bookmark");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("the Log in page does not send the user to a different website after the log in", async ({ page, spotify }) => {
  await spotify.willLogIn(testUser);
  await spotify.answerAuthorisation("agree");
  await page.goto("/log-in?next=//different.example/");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/");
});

test("the session stays after the browser closes and opens again", async ({ page, logIn, browser, baseURL }) => {
  await logIn();
  const cookie = (await page.context().cookies()).find((each) => each.name === "session")!;
  // A cookie with an expiry time stays when the browser closes. A year is 365 days.
  const days = (cookie.expires * 1000 - Date.now()) / (24 * 60 * 60 * 1000);
  expect(days).toBeGreaterThan(300);
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");

  const storage = await page.context().storageState();
  await page.context().close();
  const reopened = await browser.newContext({ baseURL, storageState: storage });
  const newPage = await reopened.newPage();
  await newPage.goto("/");

  await expect(newPage.getByRole("heading", { level: 1 })).toHaveText("Festivals");
  await reopened.close();
});

test("log out ends the session, and the next request needs a new log in", async ({ page, logIn, browser, baseURL }) => {
  await logIn();
  const cookie = (await page.context().cookies()).find((each) => each.name === "session")!;

  await page.getByRole("button", { name: "Log out" }).click();

  await expect(page).toHaveURL("/log-in");
  await page.goto("/");
  await expect(page).toHaveURL("/log-in");

  // A copy of the old cookie does not open a session.
  const copy = await browser.newContext({ baseURL });
  await copy.addCookies([cookie]);
  const copyPage = await copy.newPage();
  await copyPage.goto("/");
  await expect(copyPage).toHaveURL("/log-in");
  await copy.close();
});

test("a different website cannot log out the user", async ({ page, logIn }) => {
  await logIn();

  const response = await page.request.post("/log-out", {
    headers: { origin: "https://different.example", "content-type": "application/x-www-form-urlencoded" },
    data: "",
    maxRedirects: 0,
  });

  expect(response.status()).toBe(403);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Festivals");
});

test("a person who is not on the allowlist sees the cause and is told to ask the admin", async ({ page, spotify }) => {
  await spotify.willRefuseNotOnAllowlist();
  await spotify.answerAuthorisation("agree");
  await page.goto("/log-in");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/log-in?problem=not-on-allowlist");
  await expect(page.getByRole("heading", { name: "Your Spotify account is not on the allowlist" })).toBeVisible();
  await expect(page.getByText("Ask the admin to add your account.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Log out" })).toHaveCount(0);
  await page.goto("/");
  await expect(page).toHaveURL("/log-in");
});

test("a person who cancels on Spotify sees that the log in was cancelled", async ({ page, spotify }) => {
  await spotify.answerAuthorisation("cancel");
  await page.goto("/log-in");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/log-in?problem=cancelled");
  await expect(page.getByRole("heading", { name: "You cancelled the log in" })).toBeVisible();
});

test("a log in fails with a message when Spotify refuses the request", async ({ page, spotify, testServer }) => {
  await spotify.answerAuthorisation("agree");
  await testServer.respondTo("POST", spotifyTokenUrl, { status: 503, body: "Service unavailable" });
  await page.goto("/log-in");

  await page.getByRole("button", { name: "Log in with Spotify" }).click();

  await expect(page).toHaveURL("/log-in?problem=failed");
  await expect(page.getByRole("heading", { name: "The log in did not complete" })).toBeVisible();
});

test("a callback without the values from the start of the log in fails", async ({ page, testServer }) => {
  await page.goto("/log-in/callback?code=stolen-code&state=guessed-state");

  await expect(page).toHaveURL("/log-in?problem=failed");
  expect(await testServer.sentHttpRequests()).toEqual([]);
});

test("the configured Spotify account gets the admin role", async ({ page, logIn }) => {
  await logIn(testAdmin);

  // The admin area has no pages yet, so the admin gets Page not found and not the permission-restricted state.
  const response = await page.goto("/admin/festivals");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("a user who is not the admin sees the permission-restricted state on admin pages", async ({ page, logIn }) => {
  await logIn(testUser);

  for (const path of ["/admin", "/admin/festivals"]) {
    const response = await page.goto(path);

    expect(response?.status()).toBe(403);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Only the admin can open this page");
  }
  await page.getByRole("link", { name: "Show the festivals" }).click();
  await expect(page).toHaveURL("/");
});

test("a person who is not logged in must log in before an admin page", async ({ page }) => {
  await page.goto("/admin/festivals");

  await expect(page).toHaveURL("/log-in?next=%2Fadmin%2Ffestivals");
});

test("the user can log in and log out with the keyboard only", async ({ page, spotify }) => {
  await spotify.willLogIn(testUser);
  await spotify.answerAuthorisation("agree");
  await page.goto("/log-in");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const logInButton = page.getByRole("button", { name: "Log in with Spotify" });
  await expect(logInButton).toBeFocused();
  await expect(logInButton).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");

  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const logOutButton = page.getByRole("button", { name: "Log out" });
  await expect(logOutButton).toBeFocused();
  await expect(logOutButton).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/log-in");
});

const anonymousPages = [
  "/log-in",
  "/log-in?problem=not-on-allowlist",
  "/log-in?problem=cancelled",
  "/log-in?problem=failed",
];
for (const path of anonymousPages) {
  test(`${path} has no WCAG 2.2 AA violations that axe can find`, async ({ page }) => {
    await page.goto(path);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

test("the admin-only page has no WCAG 2.2 AA violations that axe can find", async ({ page, logIn }) => {
  await logIn(testUser);
  await page.goto("/admin/festivals");

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  expect(results.violations).toEqual([]);
});
