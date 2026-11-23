import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures.ts";
import { fallbackArtist, largeFestival, testSetlistFmAddress, testSpotifyArtistId, testTrackId } from "./large-lineup.ts";

// Listen before choosing an interest level (#18). The Festival page plays the
// predicted songs of an artist with the Spotify embed player, and links to the artist
// in Spotify and to its setlists on setlist.fm. The fixtures give a fake of the
// Spotify iFrame API and of the embed player page (fixtures.ts).

const spotifyIframeApi = "https://open.spotify.com/embed/iframe-api/v1";
const fallbackName = largeFestival.artists[fallbackArtist]!.name;

let festivalPath = "";

test.beforeEach(async ({ testServer, logIn }) => {
  festivalPath = `/festivals/${await testServer.addPublishedFestival(largeFestival)}`;
  await logIn();
});

function row(page: Page, artist: string) {
  return page.getByRole("region", { name: "Lineup" }).getByRole("listitem").filter({ has: page.locator(".artist-name", { hasText: new RegExp(`^${artist}$`) }) });
}

function playButton(page: Page, artist: string) {
  return page.getByRole("button", { name: `Play the songs for ${artist}`, exact: true });
}

function closeButton(page: Page, artist: string) {
  return page.getByRole("button", { name: `Close the player for ${artist}`, exact: true });
}

function player(page: Page, artist: string) {
  return page.frameLocator(`iframe[title="Spotify player for ${artist}"]`);
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .include(".lineup")
    // Spotify draws the content of the player, so the check does not include the document in the iframe.
    .exclude(".listen-embed iframe")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test("each artist links to its Spotify artist and to its setlists on setlist.fm, without nofollow", async ({ page }) => {
  await page.goto(festivalPath);

  const ghost = row(page, "Ghost");
  const spotify = ghost.getByRole("link", { name: "Ghost on Spotify", exact: true });
  await expect(spotify).toHaveAttribute("href", `https://open.spotify.com/artist/${testSpotifyArtistId(2)}`);
  const setlists = ghost.getByRole("link", { name: "Ghost on setlist.fm", exact: true });
  await expect(setlists).toHaveAttribute("href", testSetlistFmAddress(2));
  await expect(setlists).not.toHaveAttribute("rel", /nofollow/);
  await expect(page.getByRole("link", { name: / on setlist\.fm$/ })).toHaveCount(148);
  await expect(page.getByRole("link", { name: / on Spotify$/ })).toHaveCount(149);
});

test("an artist with the Spotify search fallback shows that its songs are not predicted, and has no setlist.fm link", async ({ page }) => {
  await page.goto(festivalPath);

  const fallback = row(page, fallbackName);
  await expect(fallback).toContainText("The songs come from a Spotify search, not from setlists.");
  await expect(fallback.getByRole("link", { name: /setlist\.fm/ })).toHaveCount(0);
  await expect(playButton(page, fallbackName)).toBeVisible();
  await expect(page.getByText("The songs come from a Spotify search, not from setlists.")).toHaveCount(1);
});

test("an artist without predicted songs and without a Spotify artist has no player and no links", async ({ page }) => {
  await page.goto(festivalPath);

  const broken = row(page, "Broken Choir");
  await expect(broken).toContainText("No predicted songs");
  await expect(broken.getByRole("button")).toHaveCount(0);
  await expect(broken.getByRole("link")).toHaveCount(0);
});

test("the user plays the predicted songs of an artist in order, and only one player is open", async ({ page }) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url() === spotifyIframeApi) apiRequests.push(request.url());
  });
  await page.goto(festivalPath);
  // The page loads the Spotify iFrame API only when the user selects "Play the songs".
  expect(apiRequests).toEqual([]);

  await playButton(page, "Ghost").click();
  const ghost = row(page, "Ghost");
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();
  await expect(ghost.getByText("Song 1 of 10")).toBeVisible();
  await expect(closeButton(page, "Ghost")).toHaveAttribute("aria-expanded", "true");
  await expect(ghost.getByRole("button", { name: "Previous song" })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { fakeSpotifyEmbed: { played: string[] } }).fakeSpotifyEmbed.played)).toEqual([
    `spotify:track:${testTrackId(2, 0)}`,
  ]);

  await ghost.getByRole("button", { name: "Next song" }).click();
  await expect(ghost.getByText("Song 2 of 10")).toBeVisible();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 1)}`)).toBeVisible();
  await ghost.getByRole("button", { name: "Previous song" }).click();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();

  // A different artist closes the first player.
  await playButton(page, "Black Static").click();
  await expect(player(page, "Black Static").getByText(`Track ${testTrackId(9, 0)}`)).toBeVisible();
  await expect(page.locator(".listen-player")).toHaveCount(1);
  await expect(playButton(page, "Ghost")).toHaveAttribute("aria-expanded", "false");
  // "Black Static" has 1 predicted song.
  const blackStatic = row(page, "Black Static");
  await expect(blackStatic.getByText("Song 1 of 1")).toBeVisible();
  await expect(blackStatic.getByRole("button", { name: "Next song" })).toBeDisabled();
  expect(apiRequests).toHaveLength(1);

  await closeButton(page, "Black Static").click();
  await expect(page.locator(".listen-player")).toHaveCount(0);
  await expect(playButton(page, "Black Static")).toBeFocused();
});

test("at the end of a song, the player plays the next song", async ({ page }) => {
  await page.goto(festivalPath);
  await playButton(page, "Ghost").click();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();

  const update = (data: object) =>
    page.evaluate((each) => (window as unknown as { fakeSpotifyEmbed: { update(data: object): void } }).fakeSpotifyEmbed.update(each), data);
  // A pause in the song does not change the song.
  await update({ isPaused: false, isBuffering: false, position: 10_000, duration: 30_000 });
  await update({ isPaused: true, isBuffering: false, position: 10_000, duration: 30_000 });
  await expect(row(page, "Ghost").getByText("Song 1 of 10")).toBeVisible();
  await update({ isPaused: false, isBuffering: false, position: 29_500, duration: 30_000 });
  await update({ isPaused: true, isBuffering: false, position: 0, duration: 30_000 });
  await expect(row(page, "Ghost").getByText("Song 2 of 10")).toBeVisible();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 1)}`)).toBeVisible();
});

test("the player is usable with the keyboard, and it does not cover the interest levels", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(festivalPath);

  await playButton(page, "Ghost").focus();
  await page.keyboard.press("Enter");
  const ghost = row(page, "Ghost");
  await expect(ghost.getByText("Song 1 of 10")).toBeVisible();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();
  await ghost.getByRole("button", { name: "Next song" }).focus();
  await page.keyboard.press("Enter");
  await expect(ghost.getByText("Song 2 of 10")).toBeVisible();
  // Tab goes from the player to the interest levels of the same artist.
  await page.keyboard.press("Tab");
  await expect(ghost.getByRole("radio", { name: "Curious" })).toBeFocused();

  const playerBox = (await ghost.locator(".listen-player").boundingBox())!;
  const levelsBox = (await ghost.getByRole("radiogroup").boundingBox())!;
  const nextRowBox = (await ghost.locator("xpath=following-sibling::li[1]").boundingBox())!;
  expect(playerBox.y + playerBox.height).toBeLessThanOrEqual(levelsBox.y);
  expect(levelsBox.y + levelsBox.height).toBeLessThanOrEqual(nextRowBox.y);
  expect(playerBox.x + playerBox.width).toBeLessThanOrEqual(320);
  expect(await axeViolations(page)).toEqual([]);
});

test("a search that hides the artist closes the player; a search that shows it keeps the player", async ({ page }) => {
  await page.goto(festivalPath);
  await playButton(page, "Ghost").click();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();

  const search = page.getByLabel("Search by artist name");
  await search.fill("gho");
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();
  await search.fill("black");
  await expect(page.locator(".listen-player")).toHaveCount(0);
  await search.fill("");
  await expect(playButton(page, "Ghost")).toHaveAttribute("aria-expanded", "false");
});

test("when the Spotify iFrame API does not load, the player shows the problem", async ({ page }) => {
  await page.route(spotifyIframeApi, (route) => route.abort("connectionfailed"));
  await page.goto(festivalPath);

  await playButton(page, "Ghost").click();
  await expect(row(page, "Ghost").getByRole("alert")).toHaveText("The Spotify player did not load. Try again later.");
  await expect(row(page, "Ghost").getByRole("button", { name: "Next song" })).toBeDisabled();

  // The next attempt loads the API again.
  await page.unroute(spotifyIframeApi);
  await closeButton(page, "Ghost").click();
  await playButton(page, "Ghost").click();
  await expect(player(page, "Ghost").getByText(`Track ${testTrackId(2, 0)}`)).toBeVisible();
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the page has the links to Spotify and setlist.fm, and no player button", async ({ page }) => {
    await page.goto(festivalPath);

    await expect(page.getByRole("button", { name: /^Play the songs/ })).toHaveCount(0);
    await expect(row(page, "Ghost").getByRole("link", { name: "Ghost on Spotify", exact: true })).toBeVisible();
    await expect(row(page, "Ghost").getByRole("link", { name: "Ghost on setlist.fm", exact: true })).toBeVisible();
  });
});
