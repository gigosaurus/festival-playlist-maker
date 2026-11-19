import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { download2027Response, incorrectKeyResponse } from "../support/clashfinder.ts";
import { matchNames, waitForSearches } from "./artist-match-steps.ts";
import { expect, test, testAdmin, testUser, type Clashfinder } from "./fixtures.ts";

interface FestivalValues {
  name: string;
  startDate: string;
  endDate: string;
}

const download: FestivalValues = { name: "Download", startDate: "2027-06-11", endDate: "2027-06-13" };
const slamDunk: FestivalValues = { name: "Slam Dunk", startDate: "2027-05-22", endDate: "2027-05-23" };

// Adds a festival in 2027 with the Clashfinder page download27 (10 lineup names).
async function addFestival(page: Page, clashfinder: Clashfinder, { name, startDate, endDate }: FestivalValues): Promise<void> {
  await clashfinder.willGiveList();
  await clashfinder.willGiveLineup("download27", download2027Response);
  const query = new URLSearchParams({ name, year: "2027", startDate, endDate, expectedGenres: "metal", search: "Download" });
  await page.goto(`/admin/festivals/new?${query}`);
  await page.getByRole("radio", { name: "Download Festival 2027" }).check();
  await page.getByRole("button", { name: "Add the festival" }).click();
  await expect(page).toHaveURL(/added=/);
}

function festivalPanel(page: Page, title: string) {
  return page.getByRole("article", { name: title });
}

async function openArtistMatches(page: Page, title: string): Promise<void> {
  await page.goto("/admin/festivals");
  await festivalPanel(page, title).getByRole("link", { name: /^Match the artists for/ }).click();
  await waitForSearches(page);
}

async function publish(page: Page, title: string): Promise<void> {
  await page.goto("/admin/festivals");
  await festivalPanel(page, title).getByRole("button", { name: `Publish ${title}` }).click();
  await expect(page.getByRole("heading", { name: `Published ${title}` })).toBeVisible();
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test.describe("admin", () => {
  test.beforeEach(async ({ logIn, musicBrainz, spotify }) => {
    await logIn(testAdmin);
    await musicBrainz.willGiveRecordedResponses();
    await spotify.willGiveRecordedArtists();
  });

  test("the admin cannot publish a festival until each lineup name has an artist match or a “no match” mark", async ({
    page,
    clashfinder,
  }) => {
    await addFestival(page, clashfinder, download);
    const panel = festivalPanel(page, "Download 2027");
    await expect(panel).toContainText("10 lineup names have no artist match.");
    await expect(panel).toContainText("You can publish the festival when each lineup name has an artist match or a “no match” mark.");
    await expect(panel.getByRole("button", { name: /^Publish/ })).toHaveCount(0);

    await openArtistMatches(page, "Download 2027");
    await matchNames(page, 1);
    await page.goto("/admin/festivals");
    await expect(panel).toContainText("1 lineup name has no artist match.");
    await expect(panel.getByRole("button", { name: /^Publish/ })).toHaveCount(0);

    await panel.getByRole("link", { name: /^Match the artists for/ }).click();
    await matchNames(page);
    await page.goto("/admin/festivals");
    await expect(panel).toContainText("Each lineup name has an artist match.");
    await expect(panel.getByText("You can publish the festival")).toHaveCount(0);
    await expect(panel.getByText("Not published")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);

    await panel.getByRole("button", { name: "Publish Download 2027" }).click();

    await expect(page.getByRole("heading", { name: "Published Download 2027" })).toBeVisible();
    await expect(page.getByText("Users can see it on the Festivals page.")).toBeVisible();
    await expect(panel.getByText("Published", { exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Download 2027/ })).toBeVisible();
  });

  test("a publish request for a festival with unmatched names does not publish it, and the page shows the cause", async ({
    page,
    clashfinder,
  }) => {
    await addFestival(page, clashfinder, download);

    // The form is not on the page, so the test sends the request that an old page could send.
    await page.evaluate(() => {
      const form = document.createElement("form");
      form.method = "post";
      form.action = "/admin/festivals/1/publish";
      document.body.append(form);
      form.submit();
    });

    await expect(page.getByRole("heading", { name: "The application did not publish Download 2027" })).toBeVisible();
    await expect(page.getByText("The cause is with the festival in the list.")).toBeVisible();
    const panel = festivalPanel(page, "Download 2027");
    await expect(panel).toContainText("10 lineup names have no artist match.");
    await expect(panel.getByText("Not published")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test("the admin cannot publish a festival without a lineup", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", incorrectKeyResponse);
    const query = new URLSearchParams({
      name: "Download",
      year: "2027",
      startDate: "2027-06-11",
      endDate: "2027-06-13",
      expectedGenres: "metal",
      search: "Download",
    });
    await page.goto(`/admin/festivals/new?${query}`);
    await page.getByRole("radio", { name: "Download Festival 2027" }).check();
    await page.getByRole("button", { name: "Add the festival" }).click();

    const panel = festivalPanel(page, "Download 2027");
    await expect(panel).toContainText("You can publish the festival when it has a lineup.");
    await expect(panel.getByRole("button", { name: /^Publish/ })).toHaveCount(0);
  });
});

test.describe("user", () => {
  // The admin publishes Slam Dunk 2027 and Download 2027. Download Warm Up 2027 stays hidden.
  test.beforeEach(async ({ page, logIn, musicBrainz, spotify, clashfinder, context }) => {
    await logIn(testAdmin);
    await musicBrainz.willGiveRecordedResponses();
    await spotify.willGiveRecordedArtists();
    await addFestival(page, clashfinder, download);
    await openArtistMatches(page, "Download 2027");
    await matchNames(page);
    await publish(page, "Download 2027");
    // The match of a lineup name applies to each festival, so the next festivals have no unmatched names.
    await addFestival(page, clashfinder, slamDunk);
    await publish(page, "Slam Dunk 2027");
    await addFestival(page, clashfinder, { name: "Download Warm Up", startDate: "2027-06-01", endDate: "2027-06-01" });
    await context.clearCookies();
    await logIn(testUser);
  });

  test("the Festivals page shows only the published festivals, each with its year and dates, the next festival first", async ({
    page,
  }) => {
    await page.goto("/");

    const festivals = page.getByRole("main").getByRole("listitem");
    await expect(festivals).toHaveText([/^\s*Slam Dunk 2027\s+22\s*–\s*23 May 2027\s*$/, /^\s*Download 2027\s+11\s*–\s*13 June 2027\s*$/]);
    await expect(page.getByText("Download Warm Up")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Complete festivals" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "There are no published festivals" })).toHaveCount(0);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("complete festivals show below the festivals that are still to come", async ({ page, testServer }) => {
    // After the last day of Slam Dunk, before Download. 23:30 UTC is 00:30 in the United Kingdom.
    await testServer.setTime(new Date("2027-05-23T23:30:00Z"));

    await page.goto("/");

    await expect(page.getByRole("main").getByRole("listitem")).toHaveText([/Download 2027/, /Slam Dunk 2027/]);
    const complete = page.getByRole("region", { name: "Complete festivals" });
    await expect(complete.getByRole("listitem")).toHaveText([/Slam Dunk 2027/]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("a festival is still to come on its last day", async ({ page, testServer }) => {
    await testServer.setTime(new Date("2027-05-23T22:30:00Z"));

    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Complete festivals" })).toHaveCount(0);
  });

  test("each festival opens its Festival page", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: /Download 2027/ }).click();

    await expect(page).toHaveURL("/festivals/1");
    await expect(page).toHaveTitle("Download 2027 – Festival Playlist Maker");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Download 2027");
    await expect(page.getByText(/^11\s*–\s*13 June 2027$/)).toBeVisible();
    // Names marked "no match" are not artists, so they do not show.
    const lineup = page.getByRole("region", { name: "Lineup" });
    await expect(lineup.getByRole("listitem").filter({ hasText: "???" })).toHaveCount(0);
    await expect(lineup.getByRole("listitem").filter({ hasText: "Bring Me The Horizon" })).toHaveCount(1);
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("link", { name: "Festivals", exact: true }).click();
    await expect(page).toHaveURL("/");
  });

  test("a user can open a festival with the keyboard only", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: /Slam Dunk 2027/ });

    await link.focus();
    await expect(link).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Slam Dunk 2027");
  });

  test("a festival that is not published has no Festival page", async ({ page }) => {
    const response = await page.goto("/festivals/3");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
  });
});
