import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { download2027Response, signedExportUrl } from "../support/clashfinder.ts";
import { expect, test, testAdmin, testUser, type TestServer } from "./fixtures.ts";

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

// A published Download 2027 with 3 artists. Its lineup source is the Clashfinder page "test".
// The lineup is from 15 January 2027 at 12:00, the default time of the fake clock.
function addDownload(testServer: TestServer): Promise<number> {
  return testServer.addPublishedFestival({
    name: "Download",
    year: 2027,
    startDate: "2027-06-11",
    endDate: "2027-06-13",
    artists: ["Turnstile", "Evanescence", "Ghost"].map((name) => ({ name, genres: ["metal"] })),
    noMatch: [],
  });
}

async function exportRequests(testServer: TestServer, page: string): Promise<number> {
  return (await testServer.sentHttpRequests()).filter((request) => request.url === signedExportUrl(page)).length;
}

test.describe("admin", () => {
  test.beforeEach(async ({ logIn }) => {
    await logIn(testAdmin);
  });

  test("the daily lineup check gets new names, and the admin opens them on Admin: artist matches", async ({
    page,
    clashfinder,
    musicBrainz,
    testServer,
  }) => {
    await musicBrainz.willGiveRecordedResponses();
    await addDownload(testServer);
    // The Clashfinder page has 10 names: Turnstile and Evanescence, and 8 new names. Ghost is not on it.
    await clashfinder.willGiveLineup("test", download2027Response);

    // On the same day as the lineup, the check sends no request.
    await testServer.runLineupCheck();
    expect(await exportRequests(testServer, "test")).toBe(0);

    await testServer.setTime(new Date("2027-01-16T07:00:00Z"));
    await testServer.runLineupCheck();
    expect(await exportRequests(testServer, "test")).toBe(1);

    await page.goto("/admin/festivals");
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival.locator(".status-label")).toHaveText("Published");
    await expect(festival).toContainText("10 lineup names, from 16 January 2027 at 07:00");
    await expect(festival).toContainText(/Lineup check\s*Each day until the festival starts/);
    const change = festival.locator(".facts div", { hasText: "Last lineup change" });
    await expect(change).toContainText("16 January 2027 at 07:00");
    await expect(change).toContainText(/8 new names:\s*\?\?\?, Blink 182, Bring Me The Horizon, Faith No More,/);
    await expect(change).toContainText(/1 removed name:\s*Ghost/);
    await expect(festival).toContainText("8 lineup names have no artist match.");
    expect(await axeViolations(page)).toEqual([]);

    // A second check on the same day sends no request.
    await testServer.setTime(new Date("2027-01-16T20:00:00Z"));
    await testServer.runLineupCheck();
    expect(await exportRequests(testServer, "test")).toBe(1);

    await festival.getByRole("link", { name: "Bring Me The Horizon" }).click();
    await expect(page).toHaveURL(/\/admin\/festivals\/1\/artist-matches#name-\d+$/);
    const name = page.getByRole("article", { name: "Bring Me The Horizon New" });
    await expect(name).toBeVisible();
    await expect(name).toBeInViewport();
    // A name that was on the lineup before the check has no badge.
    await expect(page.locator(".matched-lineup-name", { hasText: "Turnstile" })).not.toContainText("New");
    expect(await axeViolations(page)).toEqual([]);
  });

  test("a lineup source failure in the check shows the cause, and the festival keeps its lineup", async ({
    page,
    clashfinder,
    testServer,
  }) => {
    await addDownload(testServer);
    await clashfinder.willGiveLineup("test", { status: 503, body: "Service unavailable" });
    await testServer.setTime(new Date("2027-01-16T07:00:00Z"));

    await testServer.runLineupCheck();

    await page.goto("/admin/festivals");
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival).toContainText("3 lineup names, from 15 January 2027 at 12:00");
    await expect(festival).toContainText("The application did not get the lineup on 16 January 2027 at 07:00.");
    await expect(festival).toContainText('Clashfinder did not give the page "test" (status 503).');
    await expect(festival).toContainText("The festival keeps its previous lineup.");
    await expect(festival).not.toContainText("Last lineup change");
    await expect(festival.locator(".status-label")).toHaveText("Published");
  });

  test("the admin changes the lineup source, and the application gets the lineup from the new page", async ({
    page,
    clashfinder,
    testServer,
  }) => {
    await addDownload(testServer);
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", download2027Response);
    await page.goto("/admin/festivals");

    await page.getByRole("link", { name: "Change the lineup source of Download 2027" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Change the lineup source of Download 2027");
    await expect(page.getByLabel("Name or address of the Clashfinder page")).toHaveValue("Download");
    await expect(page.getByRole("button", { name: "Change the lineup source" })).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "Search Clashfinder" }).click();
    await expect(page).toHaveURL(/\/admin\/festivals\/1\/lineup-source\?search=Download$/);

    // The admin selects the action before a choice.
    await page.getByRole("button", { name: "Change the lineup source" }).click();
    await expect(page).toHaveTitle("Error: Change the lineup source of Download 2027 – Festival Playlist Maker");
    await expect(page.getByRole("region", { name: "Correct the problem to change the lineup source" })).toBeFocused();
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("radio", { name: "Download Festival 2027" }).check();
    await page.getByRole("button", { name: "Change the lineup source" }).click();

    await expect(page).toHaveURL("/admin/festivals?source=1");
    const notice = page.getByRole("region", { name: "Changed the lineup source of Download 2027" });
    await expect(notice).toContainText("Got 10 lineup names from Clashfinder. The lineup check found 8 new names and 1 removed name.");
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival.getByRole("link", { name: "Download Festival 2027" })).toHaveAttribute(
      "href",
      "https://clashfinder.com/s/download27/",
    );
    await expect(festival.locator(".status-label")).toHaveText("Published");
    expect(await axeViolations(page)).toEqual([]);

    // The next lineup check uses the new page.
    await testServer.setTime(new Date("2027-01-16T07:00:00Z"));
    await testServer.runLineupCheck();
    expect(await exportRequests(testServer, "download27")).toBe(2);
    expect(await exportRequests(testServer, "test")).toBe(0);
  });

  test("the change of the lineup source fails, and the festival keeps its lineup", async ({ page, clashfinder, testServer }) => {
    await addDownload(testServer);
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", { status: 503, body: "Service unavailable" });

    await page.goto("/admin/festivals/1/lineup-source?search=Download");
    await page.getByRole("radio", { name: "Download Festival 2027" }).check();
    await page.getByRole("button", { name: "Change the lineup source" }).click();

    const notice = page.getByRole("region", { name: "Changed the lineup source of Download 2027" });
    await expect(notice).toContainText("The application did not get the lineup from the new source. The cause is with the festival in the list.");
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival).toContainText("3 lineup names, from 15 January 2027 at 12:00");
    await expect(festival).toContainText('Clashfinder did not give the page "download27" (status 503).');
  });
});

test("a user who is not the admin cannot change the lineup source", async ({ page, logIn, testServer }) => {
  await addDownload(testServer);
  await logIn(testUser);

  const response = await page.goto("/admin/festivals/1/lineup-source");
  const origin = new URL(page.url()).origin;
  const post = await page.request.post("/admin/festivals/1/lineup-source", { form: { page: "download27" }, headers: { origin } });

  expect(response?.status()).toBe(403);
  expect(post.status()).toBe(403);
});
