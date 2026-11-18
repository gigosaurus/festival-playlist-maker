import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { clashfinderCrawlDelay } from "../../src/http-client.ts";
import {
  download2027Response,
  incorrectKeyResponse,
  signedExportUrl,
  signedListUrl,
  unknownUserResponse,
} from "../support/clashfinder.ts";
import { expect, test, testAdmin, testUser } from "./fixtures.ts";

const download = { name: "Download", year: "2027", startDate: "2027-06-11", endDate: "2027-06-13", genres: "metal, hard rock" };

async function fillFestival(page: Page, values = download): Promise<void> {
  await page.getByLabel("Name", { exact: true }).fill(values.name);
  await page.getByLabel("Year").fill(values.year);
  await page.getByLabel("First day").fill(values.startDate);
  await page.getByLabel("Last day").fill(values.endDate);
  await page.getByLabel("Expected genres").fill(values.genres);
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test.describe("admin", () => {
  test.beforeEach(async ({ logIn }) => {
    await logIn(testAdmin);
  });

  test("the admin opens Manage festivals from the site header and sees the empty state", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "Manage festivals" }).click();

    await expect(page).toHaveURL("/admin/festivals");
    await expect(page).toHaveTitle("Manage festivals – Festival Playlist Maker");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Manage festivals");
    await expect(page.getByRole("heading", { name: "There are no festivals" })).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test("the admin adds a festival from a Clashfinder search, and the application gets the lineup at once", async ({
    page,
    clashfinder,
    testServer,
  }) => {
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", download2027Response);
    await page.goto("/admin/festivals");
    await page.getByRole("link", { name: "Add a festival" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Add a festival");
    await expect(page.getByRole("button", { name: "Add the festival" })).toHaveCount(0);

    await fillFestival(page);
    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    // The search text is empty, so the search uses the festival name.
    await expect(page.getByRole("heading", { name: "Pages that match “Download”" })).toBeVisible();
    const results = page.getByRole("group", { name: "Clashfinder page" });
    await expect(results.getByRole("radio").first()).toHaveAccessibleName("Download Festival 2027");
    await expect(page.getByLabel("Year")).toHaveValue("2027");
    expect(await axeViolations(page)).toEqual([]);

    await results.getByRole("radio", { name: "Download Festival 2027" }).check();
    await page.getByRole("button", { name: "Add the festival" }).click();

    await expect(page).toHaveURL(/\/admin\/festivals\?added=\d+$/);
    await expect(page.getByRole("heading", { name: "Added Download 2027" })).toBeVisible();
    await expect(page.getByText("Got 10 lineup names from Clashfinder.")).toBeVisible();
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival).toContainText(/11\s?–\s?13 June 2027/);
    await expect(festival).toContainText("Not published");
    await expect(festival).toContainText("Clashfinder: Download Festival 2027");
    await expect(festival).toContainText("10 lineup names, from 15 January 2027 at 12:00");
    await expect(festival).toContainText("metal, hard rock");
    await expect(festival.getByRole("link", { name: "Download Festival 2027" })).toHaveAttribute(
      "href",
      "https://clashfinder.com/s/download27/",
    );

    // Two signed requests, one at a time, with the crawl delay between them.
    const requests = (await testServer.sentHttpRequests()).filter(({ url }) => url.startsWith("https://clashfinder.com/"));
    expect(requests.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `GET ${signedListUrl}`,
      `GET ${signedExportUrl("download27")}`,
    ]);
    expect(await testServer.sleeps()).toEqual([clashfinderCrawlDelay]);
    expect(await axeViolations(page)).toEqual([]);
  });

  test("the search shows pages with a different name that start on the festival dates", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await page.goto("/admin/festivals/new");
    await fillFestival(page);

    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await expect(page.getByRole("heading", { name: "Other pages that start on the festival dates" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Time Wave" })).toBeVisible();
    const timeWave = page.getByRole("listitem").filter({ has: page.getByRole("radio", { name: "Time Wave" }) });
    await expect(timeWave).toContainText("Starts 11 June 2027");
    await expect(timeWave).toContainText("72 acts");
  });

  test("the admin chooses between duplicate pages with their dates, sizes and Clashfinder marks", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await page.goto("/admin/festivals/new");
    await fillFestival(page, { ...download, name: "Slam Dunk", year: "2026", startDate: "2026-05-23", endDate: "2026-05-24" });

    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    const duplicates = page.getByRole("radio", { name: "Slam Dunk 2026", exact: true });
    await expect(duplicates).toHaveCount(3);
    const core = page.getByRole("listitem").filter({ has: page.getByText("Core page") }).first();
    await expect(core).toContainText("Slam Dunk 2026");
    await expect(core).toContainText("Starts 23 May 2026 · 2 days · 8 stages · 62 acts · Last change 22 May 2026");
    await expect(core.getByRole("link", { name: "Open slamdunk2026 on Clashfinder" })).toHaveAttribute("target", "_blank");
  });

  test("the search finds a page from its Clashfinder address", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await page.goto("/admin/festivals/new");

    await page.getByLabel("Name or address of the Clashfinder page").fill("https://clashfinder.com/s/download2k26/");
    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await expect(page.getByRole("radio").first()).toHaveAccessibleName("Download 2026");
    await expect(page.getByText("Enter the festival dates to also see the pages that start on those dates.")).toBeVisible();
  });

  test("a search without results tells the admin what the search included", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await page.goto("/admin/festivals/new");
    await fillFestival(page, { ...download, name: "Glastonbury", year: "2030", startDate: "2030-06-26", endDate: "2030-06-30" });

    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await expect(page.getByRole("heading", { name: "No Clashfinder page matches “Glastonbury”" })).toBeVisible();
    await expect(page.getByText("No other page starts on the festival dates.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add the festival" })).toHaveCount(0);
  });

  test("a Clashfinder failure during the search shows its cause", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList(unknownUserResponse);
    await page.goto("/admin/festivals/new");
    await fillFestival(page);

    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await expect(page.getByRole("heading", { name: "The search did not complete" })).toBeVisible();
    await expect(page.getByText("Clashfinder refused the API key (status 401): User not found: nobody-here.")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
  });

  test("a search with no name and no search text tells the admin what to enter, and sends no request", async ({
    page,
    testServer,
  }) => {
    await page.goto("/admin/festivals/new");
    const afterLogIn = (await testServer.sentHttpRequests()).length;

    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await expect(page).toHaveTitle("Error: Add a festival – Festival Playlist Maker");
    await expect(page.getByRole("region", { name: "Correct the problems to add the festival" })).toBeFocused();
    await page.getByRole("link", { name: "Enter the name of the festival, or a search text." }).click();
    await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
    expect(await testServer.sentHttpRequests()).toHaveLength(afterLogIn);
  });

  test("the admin cannot add a festival without a Clashfinder page", async ({ page }) => {
    await page.goto("/admin/festivals");
    // Without search results, the page has no "Add the festival" button. A direct request shows the problem.
    const response = await page.request.post("/admin/festivals", {
      form: { name: "Download", year: "2027", startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: "metal" },
      headers: { origin: new URL(page.url()).origin },
    });

    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("Choose a Clashfinder page from the search results.");
    await page.goto("/admin/festivals");
    await expect(page.getByRole("heading", { name: "There are no festivals" })).toBeVisible();
  });

  test("the add form shows each problem next to its field, after a search", async ({ page, clashfinder, testServer }) => {
    await clashfinder.willGiveList();
    await page.goto("/admin/festivals/new");
    await fillFestival(page, { name: "Download 2027", year: "27", startDate: "2027-06-11", endDate: "2027-06-01", genres: " , " });
    await page.getByLabel("Name or address of the Clashfinder page").fill("Download");
    await page.getByRole("button", { name: "Search Clashfinder" }).click();

    await page.getByRole("button", { name: "Add the festival" }).click();

    const summary = page.getByRole("region", { name: "Correct the problems to add the festival" });
    await expect(summary).toBeFocused();
    await expect(summary.getByRole("listitem")).toHaveText([
      "Enter the year as four digits from 2000 to 2100, for example 2027.",
      "Enter an end date on or after the start date.",
      "Enter one or more expected genres.",
      "Choose a Clashfinder page from the search results.",
    ]);
    await expect(page.getByLabel("Year")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Year")).toHaveValue("27");
    await expect(page.getByLabel("Last day")).toHaveAccessibleDescription("Enter an end date on or after the start date.");
    // The page shows the search results again from the list that the application keeps.
    await expect(page.getByRole("radio", { name: "Download Festival 2027" })).toBeVisible();
    const clashfinderRequests = (await testServer.sentHttpRequests()).filter(({ url }) => url.startsWith("https://clashfinder.com/"));
    expect(clashfinderRequests).toHaveLength(1);
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("link", { name: "Enter one or more expected genres." }).click();
    await expect(page.getByLabel("Expected genres")).toBeFocused();
  });

  test("the admin cannot add the same festival two times", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", download2027Response);
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto("/admin/festivals/new");
      await fillFestival(page);
      await page.getByRole("button", { name: "Search Clashfinder" }).click();
      await page.getByRole("radio", { name: "Download Festival 2027" }).check();
      await page.getByRole("button", { name: "Add the festival" }).click();
    }

    await expect(page.getByText("Download 2027 is already on the festival list. Enter a different name or year.").first()).toBeVisible();
    await page.goto("/admin/festivals");
    await expect(page.getByRole("article")).toHaveCount(1);
  });

  test("a Clashfinder failure shows its cause, and the festival keeps its previous lineup", async ({
    page,
    clashfinder,
    testServer,
  }) => {
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", incorrectKeyResponse);
    await page.goto("/admin/festivals/new");
    await fillFestival(page);
    await page.getByRole("button", { name: "Search Clashfinder" }).click();
    await page.getByRole("radio", { name: "Download Festival 2027" }).check();

    await page.getByRole("button", { name: "Add the festival" }).click();

    // The festival is added without a lineup. The page shows the cause.
    await expect(page.getByRole("heading", { name: "Added Download 2027 without a lineup" })).toBeVisible();
    const festival = page.getByRole("article", { name: "Download 2027" });
    await expect(festival).toContainText("No lineup");
    await expect(festival).toContainText("The application did not get the lineup on 15 January 2027 at 12:00.");
    await expect(festival).toContainText("Clashfinder refused the API key (status 401): authPublicKey incorrect.");
    await expect(festival).toContainText("The festival has no lineup.");
    expect(await axeViolations(page)).toEqual([]);

    // The admin corrects the cause and gets the lineup.
    await clashfinder.willGiveLineup("download27", download2027Response);
    await festival.getByRole("button", { name: "Get the lineup for Download 2027" }).click();
    await expect(page.getByRole("heading", { name: "Got the lineup of Download 2027" })).toBeVisible();
    await expect(festival).toContainText("10 lineup names");
    await expect(festival).not.toContainText("did not get the lineup");

    // Clashfinder fails again. The festival keeps the 10 lineup names.
    await testServer.setTime(new Date("2027-01-16T09:30:00Z"));
    await clashfinder.willGiveLineup("download27", { status: 503, body: "Service unavailable" });
    await festival.getByRole("button", { name: "Get the lineup again for Download 2027" }).click();
    await expect(page.getByRole("heading", { name: "The application did not get the lineup of Download 2027" })).toBeVisible();
    await expect(page.getByRole("region", { name: "The application did not get the lineup of Download 2027" })).toContainText(
      "The cause is with the festival in the list.",
    );
    await expect(festival).toContainText("The festival keeps its previous lineup.");
    await expect(festival).toContainText("10 lineup names, from 15 January 2027 at 12:00");
    await expect(festival).toContainText("The application did not get the lineup on 16 January 2027 at 09:30.");
    await expect(festival).toContainText("Clashfinder did not give the page \"download27\" (status 503).");
  });

  test("the admin can add a festival with the keyboard only", async ({ page, clashfinder }) => {
    await clashfinder.willGiveList();
    await clashfinder.willGiveLineup("download27", download2027Response);
    await page.goto("/admin/festivals/new");
    await fillFestival(page);
    await page.getByLabel("Name or address of the Clashfinder page").focus();

    await page.keyboard.press("Enter");
    await expect(page.getByRole("radio").first()).toBeVisible();
    await page.getByRole("radio").first().focus();
    await expect(page.getByRole("radio").first()).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Space");
    const add = page.getByRole("button", { name: "Add the festival" });
    await add.focus();
    await expect(add).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Added Download 2027" })).toBeVisible();
  });
});

test.describe("user who is not the admin", () => {
  test.beforeEach(async ({ logIn }) => {
    await logIn(testUser);
  });

  test("the site header has no link to Manage festivals", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: "Manage festivals" })).toHaveCount(0);
  });

  test("a user who is not the admin cannot open the admin pages or add a festival", async ({ page, testServer }) => {
    for (const path of ["/admin/festivals", "/admin/festivals/new", "/admin/festivals/new?name=Download&search="]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(403);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Only the admin can open this page");
    }

    const origin = new URL(page.url()).origin;
    const add = await page.request.post("/admin/festivals", {
      form: { name: "Download", year: "2027", startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: "metal", page: "download27" },
      headers: { origin },
    });
    const lineup = await page.request.post("/admin/festivals/1/lineup", { headers: { origin } });

    expect(add.status()).toBe(403);
    expect(lineup.status()).toBe(403);
    expect(await testServer.sentHttpRequests()).toHaveLength(2);
  });
});
