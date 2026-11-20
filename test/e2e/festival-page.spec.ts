import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test, testAdmin } from "./fixtures.ts";
import { largeFestival } from "./large-lineup.ts";

// The Festival page with a lineup of 150 artists (largeFestival).

let festivalPath = "";

test.beforeEach(async ({ testServer, logIn }) => {
  festivalPath = `/festivals/${await testServer.addPublishedFestival(largeFestival)}`;
  await logIn();
});

function lineup(page: Page) {
  return page.getByRole("region", { name: "Lineup" });
}

function artistRows(page: Page) {
  return lineup(page).getByRole("listitem").filter({ visible: true });
}

function levels(page: Page, artist: string) {
  return lineup(page).getByRole("radiogroup", { name: artist, exact: true });
}

function level(page: Page, artist: string, name: string) {
  return levels(page, artist).getByRole("radio", { name, exact: true });
}

async function expectSaved(page: Page, artist: string, name: string): Promise<void> {
  await page.reload();
  await expect(level(page, artist, name)).toBeChecked();
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test("the page lists each artist on the lineup with its genres, at Curious, without the names marked “no match”", async ({ page }) => {
  await page.goto(festivalPath);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Download 2027");
  await expect(artistRows(page)).toHaveCount(150);
  await expect(lineup(page).getByText("150 artists", { exact: true })).toBeVisible();
  await expect(lineup(page).getByRole("radio", { name: "Curious", checked: true })).toHaveCount(150);
  await expect(page.getByText("The playlist will contain 284 songs by 149 of 150 artists.")).toBeVisible();
  await expect(artistRows(page).first()).toContainText("Black Choir");
  await expect(artistRows(page).filter({ hasText: "Bring Me The Horizon" })).toContainText("hard rock");
  await expect(lineup(page).getByText("???")).toHaveCount(0);
  await expect(lineup(page).getByText("Special guest TBA")).toHaveCount(0);
  // The script saves each change, so the page has no save button.
  await expect(page.getByRole("button", { name: "Save the interest levels" })).toBeHidden();
  expect(await axeViolations(page)).toEqual([]);
});

test("one action sets an interest level, and the level stays after a reload and in a new session", async ({
  page,
  context,
  logIn,
}) => {
  await page.goto(festivalPath);

  await level(page, "Ghost", "Must see").check();
  await level(page, "Black Choir", "Not interested").check();

  await expect(page.getByText("The playlist will contain 287 songs by 148 of 150 artists.")).toBeVisible();
  await expectSaved(page, "Ghost", "Must see");
  await expectSaved(page, "Black Choir", "Not interested");
  await expect(page.getByText("The playlist will contain 287 songs by 148 of 150 artists.")).toBeVisible();

  await context.clearCookies();
  await logIn();
  await page.goto(festivalPath);
  await expect(level(page, "Ghost", "Must see")).toBeChecked();
  await expect(level(page, "Black Choir", "Not interested")).toBeChecked();
});

test("each user has their own interest levels", async ({ page, context, logIn }) => {
  await page.goto(festivalPath);
  await level(page, "Ghost", "Keen").check();
  await expectSaved(page, "Ghost", "Keen");

  await context.clearCookies();
  await logIn(testAdmin);
  await page.goto(festivalPath);

  await expect(level(page, "Ghost", "Curious")).toBeChecked();
});

test("the last of several fast changes is the saved level", async ({ page }) => {
  await page.goto(festivalPath);

  await level(page, "Ghost", "Curious").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByText("The playlist will contain 282 songs by 148 of 150 artists.")).toBeVisible();

  await expectSaved(page, "Ghost", "Not interested");
});

test("search, filter and sort operate together, and the address keeps them", async ({ page }) => {
  await page.goto(festivalPath);
  for (const [artist, name] of [
    ["Iron Wolves", "Must see"],
    ["Iron Kings", "Keen"],
    ["Black Wolves", "Must see"],
    ["Iron Echo", "Not interested"],
  ] as const) {
    await level(page, artist, name).check();
  }
  await expect(page.getByText("The playlist will contain 292 songs by 148 of 150 artists.")).toBeVisible();
  await page.reload();

  // Search: the case and the accents are not important.
  await page.getByLabel("Search by artist name").fill("motley crue");
  await expect(artistRows(page)).toHaveText([/Mötley Crüe/]);
  await expect(lineup(page).getByText("1 of 150 artists")).toBeVisible();

  await page.getByLabel("Search by artist name").fill("iron");
  await expect(artistRows(page)).toHaveCount(13);
  await expect(lineup(page).getByText("13 of 150 artists")).toBeVisible();

  await page.getByLabel("Sort by").selectOption({ label: "Interest level, Must see first" });
  await expect(artistRows(page).locator(".artist-name")).toHaveText(expectedIronOrder());

  await page.getByLabel("Interest level", { exact: true }).selectOption({ label: "Must see" });
  await expect(artistRows(page).locator(".artist-name")).toHaveText(["Iron Wolves"]);
  await expect(lineup(page).getByText("1 of 150 artists")).toBeVisible();

  await page.getByLabel("Search by artist name").fill("");
  await expect(artistRows(page).locator(".artist-name")).toHaveText(["Black Wolves", "Iron Wolves"]);

  // The address keeps the search, the filter and the sort.
  await page.getByLabel("Search by artist name").fill("wolves");
  await expect(page).toHaveURL(`${festivalPath}?search=wolves&level=must-see&sort=level`);
  await page.reload();
  await expect(page.getByLabel("Search by artist name")).toHaveValue("wolves");
  await expect(artistRows(page).locator(".artist-name")).toHaveText(["Black Wolves", "Iron Wolves"]);
  expect(await axeViolations(page)).toEqual([]);
});

// Iron Wolves (Must see), Iron Kings (Keen), then the Curious names in
// alphabetical order, then Iron Echo (Not interested).
function expectedIronOrder(): string[] {
  const curious = ["Harbour", "Signal", "Engine", "Choir", "Valley", "Static", "Tide", "Lanterns", "Saints", "Machine"]
    .map((word) => `Iron ${word}`)
    .sort((a, b) => a.localeCompare(b));
  return ["Iron Wolves", "Iron Kings", ...curious, "Iron Echo"];
}

test("a search or a filter without results tells the user, and “Show all artists” shows the full lineup", async ({ page }) => {
  await page.goto(`${festivalPath}?search=nobody`);

  await expect(artistRows(page)).toHaveCount(0);
  await expect(lineup(page).getByText("No artist matches “nobody”.")).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.getByLabel("Search by artist name").fill("");
  await page.getByLabel("Interest level", { exact: true }).selectOption({ label: "Keen" });
  await expect(lineup(page).getByText("No artist has the interest level Keen.")).toBeVisible();

  await page.getByLabel("Search by artist name").fill("ghost");
  await expect(lineup(page).getByText("No artist with the interest level Keen matches “ghost”.")).toBeVisible();

  await page.getByRole("button", { name: "Show all artists" }).click();
  await expect(artistRows(page)).toHaveCount(150);
  await expect(page.getByLabel("Search by artist name")).toBeFocused();
  await expect(page).toHaveURL(festivalPath);
});

test("a change does not hide or move an artist until the user updates the list", async ({ page }) => {
  await page.goto(`${festivalPath}?level=curious`);
  await expect(artistRows(page)).toHaveCount(150);

  await level(page, "Ghost", "Keen").check();

  await expect(artistRows(page)).toHaveCount(150);
  await expect(level(page, "Ghost", "Keen")).toBeChecked();
  await expect(page.getByText("Your last changes do not move or hide artists until you update the list.")).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole("button", { name: "Update the list" }).click();
  await expect(artistRows(page)).toHaveCount(149);
  await expect(lineup(page).getByText("149 of 150 artists")).toBeFocused();
  await expect(page.getByRole("button", { name: "Update the list" })).toBeHidden();
});

test("a user can search and set an interest level with the keyboard only", async ({ page }) => {
  await page.goto(festivalPath);
  const search = page.getByLabel("Search by artist name");
  while (!(await search.evaluate((element) => element === document.activeElement))) await page.keyboard.press("Tab");

  await page.keyboard.type("ghost");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Interest level", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Sort by")).toBeFocused();
  await page.keyboard.press("Tab");
  const curious = level(page, "Ghost", "Curious");
  await expect(curious).toBeFocused();
  await expect(curious.locator("..")).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("ArrowRight");

  await expect(level(page, "Ghost", "Keen")).toBeChecked();
  await expectSaved(page, "Ghost", "Keen");
});

test("when a save fails, the artist shows the level that the application saved, and the problem", async ({ page }) => {
  await page.goto(festivalPath);
  await page.route(`**${festivalPath}/interest-levels`, (route) => route.fulfill({ status: 500, body: "Failed" }));

  // click, not check: the level changes back after the failure, before check can verify it.
  await level(page, "Ghost", "Not interested").click();

  const ghost = artistRows(page).filter({ hasText: "Ghost" });
  await expect(ghost.getByRole("alert")).toHaveText("The application did not save the interest level. Select it again.");
  await expect(level(page, "Ghost", "Curious")).toBeChecked();
  await expect(page.getByText("The playlist will contain 284 songs by 149 of 150 artists.")).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.unroute(`**${festivalPath}/interest-levels`);
  await level(page, "Ghost", "Keen").check();
  await expect(ghost.getByRole("alert")).toBeHidden();
  await expectSaved(page, "Ghost", "Keen");
});

test("the application refuses a level for a name that is not an artist on the lineup", async ({ page }) => {
  await page.goto(festivalPath);

  const send = (field: string, value: string) =>
    page.evaluate(
      async ([action, field, value]) => {
        const response = await fetch(action!, {
          method: "POST",
          headers: { accept: "application/json" },
          body: new URLSearchParams({ [field!]: value! }),
        });
        return response.status;
      },
      [`${festivalPath}/interest-levels`, field, value],
    );

  // The lineup names get IDs in the order of the lineup: the 150 artists, then "???".
  expect(await send("level-151", "keen")).toBe(400);
  expect(await send("level-9999", "keen")).toBe(400);
  expect(await send("level-1", "very-keen")).toBe(400);
  expect(await send("level-1", "keen")).toBe(200);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the user sets interest levels with one form and “Save the interest levels”", async ({ page }) => {
    await page.goto(festivalPath);
    await expect(page.getByRole("search")).toBeHidden();

    await level(page, "Ghost", "Must see").check();
    await level(page, "Black Choir", "Not interested").check();
    await page.getByRole("button", { name: "Save the interest levels" }).click();

    await expect(page.getByRole("heading", { name: "Saved the interest levels" })).toBeVisible();
    await expect(level(page, "Ghost", "Must see")).toBeChecked();
    await expect(page.getByText("The playlist will contain 287 songs by 148 of 150 artists.")).toBeVisible();
  });
});
