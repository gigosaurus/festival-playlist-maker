import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { download2027Response } from "../support/clashfinder.ts";
import { musicbrainzIds } from "../support/musicbrainz.ts";
import { setlistFmRecordedAt, setlistFmSetlistsUrl, setlistsResponse } from "../support/setlist-fm.ts";
import { waitForSearches } from "./artist-match-steps.ts";
import { expect, test, testAdmin, type Clashfinder } from "./fixtures.ts";

// The first predicted song of Bring Me the Horizon at the time of the recording: "DArkSide".
const firstTrack = "7mczLeiFeYKRb7vtiPjuMb";

async function addFestival(page: Page, clashfinder: Clashfinder): Promise<void> {
  await clashfinder.willGiveList();
  await clashfinder.willGiveLineup("download27", download2027Response);
  await page.goto("/admin/festivals/new?name=Download&year=2027&startDate=2027-06-11&endDate=2027-06-13&expectedGenres=metal,+rock&search=Download");
  await page.getByRole("radio", { name: "Download Festival 2027" }).check();
  await page.getByRole("button", { name: "Add the festival" }).click();
  await expect(page).toHaveURL(/added=/);
  await page.goto("/admin/festivals/1/artist-matches");
  await waitForSearches(page);
}

function matchRow(page: Page, name: string) {
  return page.getByRole("region", { name: /^Artist matches/ }).getByRole("listitem").filter({ hasText: name });
}

// The calculation runs in the background. The admin loads the page again to see the result.
async function waitForText(page: Page, text: string | RegExp): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText(text).first()).toBeVisible({ timeout: 1_000 });
  }).toPass();
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test.beforeEach(async ({ page, testServer, logIn, musicBrainz, spotify, clashfinder }) => {
  // The recorded setlists cover the look-back period before the time of the recording.
  await testServer.setTime(setlistFmRecordedAt);
  await logIn(testAdmin);
  await musicBrainz.willGiveRecordedResponses();
  await spotify.willGiveRecordedArtists();
  await addFestival(page, clashfinder);
});

test("a new artist match gets predicted songs, and the admin checks them", async ({ page, setlistFm }) => {
  await setlistFm.willGiveRecordedSetlists();

  await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

  // The page does not wait for the calculation.
  await expect(page.getByRole("heading", { name: "Matched Bring Me The Horizon to Bring Me the Horizon" })).toBeVisible();
  await waitForText(page, "Predicted songs: 10 songs from setlists");
  expect(await axeViolations(page)).toEqual([]);

  await matchRow(page, "Bring Me The Horizon").getByRole("link", { name: "Show the predicted songs for Bring Me The Horizon" }).click();

  await expect(page).toHaveTitle("Predicted songs for Bring Me The Horizon – Festival Playlist Maker");
  await expect(page.getByRole("definition").filter({ hasText: "Setlists on setlist.fm from the last 18 months" })).toBeVisible();
  // The setlist.fm attribution link (#18).
  await expect(page.getByRole("link", { name: "Setlists on setlist.fm", exact: true })).toHaveAttribute(
    "href",
    "https://www.setlist.fm/setlists/bring-me-the-horizon-73d6f639.html",
  );
  await expect(page.getByRole("definition").filter({ hasText: /Valid until 19 May 2027/ })).toBeVisible();
  const songs = page.getByRole("region", { name: "Songs in order of prediction (10)" }).getByRole("listitem");
  await expect(songs).toHaveCount(10);
  const first = page.frameLocator('iframe[title="Song 1 in the Spotify player"]');
  await expect(first.getByText(`Track ${firstTrack}`)).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);
});

test("an artist with no recent setlists uses the Spotify search fallback, and the admin sees it", async ({ page, setlistFm }) => {
  await setlistFm.willGiveRecordedSetlists();
  // Match "Turnstile" to the Japanese band "Ghost", which has setlists only from 2009.
  await page.getByRole("link", { name: "Search with a different text for Turnstile" }).click();
  await page.getByLabel("Name or address of the MusicBrainz artist").fill("Ghost");
  await page.getByRole("button", { name: "Search MusicBrainz" }).click();
  await page.getByRole("listitem").filter({ hasText: "Japanese psych rock" }).getByRole("radio", { name: "Ghost", exact: true }).check();
  await page.getByRole("button", { name: "Save the match for Turnstile" }).click();

  await waitForText(page, "Warning: no setlists in the last 60 months. 5 songs from a Spotify search.");
  await expect(page.getByText("1 artist has no setlists in the last 60 months and uses the Spotify search fallback.")).toBeVisible();

  await page.getByRole("link", { name: "Show the predicted songs for Turnstile" }).click();
  await expect(
    page.getByText("Warning: no setlists on setlist.fm in the last 60 months. The songs come from a Spotify search for the artist"),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Songs in order of prediction (5)" }).getByRole("listitem")).toHaveCount(5);
  expect(await axeViolations(page)).toEqual([]);
});

test("an artist with few recent shows gets older setlists and the long look-back mark, and the admin sees it", async ({ page, setlistFm }) => {
  await setlistFm.willGiveRecordedSetlists();
  // Match "Turnstile" to Rage Against the Machine, which has no shows after 2022.
  await page.getByRole("link", { name: "Search with a different text for Turnstile" }).click();
  await page.getByLabel("Name or address of the MusicBrainz artist").fill("Rage Against the Machine");
  await page.getByRole("button", { name: "Search MusicBrainz" }).click();
  await page.getByRole("radio", { name: "Rage Against the Machine", exact: true }).check();
  await page.getByRole("button", { name: "Save the match for Turnstile" }).click();

  await waitForText(page, "Warning: fewer than 5 shows in the last 18 months. 10 songs from setlists of the last 60 months.");
  await expect(page.getByText("1 artist has fewer than 5 shows in the last 18 months and uses older setlists.")).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  await page.getByRole("link", { name: "Show the predicted songs for Turnstile" }).click();
  const source = page.getByRole("definition").filter({ hasText: "Setlists on setlist.fm from the last 60 months." });
  await expect(source).toContainText("Warning: fewer than 5 shows in the last 18 months, so the prediction is less reliable.");
  await expect(page.getByRole("region", { name: "Songs in order of prediction (10)" }).getByRole("listitem")).toHaveCount(10);
  expect(await axeViolations(page)).toEqual([]);
});

test("the admin calculates the predicted songs of one artist again", async ({ page, setlistFm, testServer }) => {
  await setlistFm.willGiveRecordedSetlists();
  await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();
  await waitForText(page, "Predicted songs: 10 songs from setlists");
  await page.getByRole("link", { name: "Show the predicted songs for Bring Me The Horizon" }).click();
  await expect(page.getByText(/^Calculated/)).toBeVisible();
  const before = (await testServer.sentHttpRequests()).filter(({ url }) => url.startsWith("https://api.setlist.fm/")).length;
  await testServer.setTime(new Date(setlistFmRecordedAt.getTime() + 60 * 60_000));

  await page.getByRole("button", { name: "Calculate the predicted songs again" }).click();

  await expect(page).toHaveTitle("Predicted songs for Bring Me The Horizon – Festival Playlist Maker");
  await waitForText(page, /19 November 2026 at 14:/);
  const after = (await testServer.sentHttpRequests()).filter(({ url }) => url.startsWith("https://api.setlist.fm/")).length;
  expect(after - before).toBe(3);
  await expect(page.getByRole("region", { name: "Songs in order of prediction (10)" })).toBeVisible();
});

test("a failed calculation shows its cause, and the admin starts the calculations again", async ({ page, setlistFm, testServer }) => {
  // setlist.fm refuses the API key.
  await testServer.respondTo("GET", setlistFmSetlistsUrl(musicbrainzIds.bringMeTheHorizon, 1), { status: 403, body: "" });
  await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

  await waitForText(page, /^The calculation of the predicted songs stopped on /);
  await expect(page.getByText("setlist.fm refused the API key (status 403). Make sure that SETLIST_FM_API_KEY is correct.")).toBeVisible();
  await expect(matchRow(page, "Bring Me The Horizon")).toContainText("Predicted songs: waiting");
  expect(await axeViolations(page)).toEqual([]);

  await setlistFm.willGiveRecordedSetlists();
  await testServer.respondTo("GET", setlistFmSetlistsUrl(musicbrainzIds.bringMeTheHorizon, 1), setlistsResponse(musicbrainzIds.bringMeTheHorizon, 1));
  await page.getByRole("button", { name: "Calculate the predicted songs again" }).click();

  await waitForText(page, "Predicted songs: 10 songs from setlists");
  await expect(page.getByRole("heading", { name: /^The calculation of the predicted songs stopped/ })).toHaveCount(0);
});
