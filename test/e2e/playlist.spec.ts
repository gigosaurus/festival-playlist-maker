import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { spotifyMyPlaylistsUrl, spotifyPlaylistItemsUrl } from "../../src/spotify.ts";
import { forbiddenResponse, rateLimitResponse, testPlaylistId } from "../support/spotify.ts";
import { expect, test } from "./fixtures.ts";
import { largeFestival, testTrackId } from "./large-lineup.ts";

// Make the playlist on the Festival page (#15). The festival has 150 artists. At
// Curious, the playlist has 284 songs by 149 artists (largeFestival).

let festivalPath = "";

test.beforeEach(async ({ testServer, logIn }) => {
  festivalPath = `/festivals/${await testServer.addPublishedFestival(largeFestival)}`;
  await logIn();
});

function playlistSection(page: Page) {
  return page.getByRole("region", { name: "Playlist" });
}

function level(page: Page, artist: string, name: string) {
  return page.getByRole("region", { name: "Lineup" }).getByRole("radiogroup", { name: artist, exact: true }).getByRole("radio", { name, exact: true });
}

async function axeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
    .analyze();
  return results.violations;
}

test("before the playlist is made, the page shows the number of songs and artists, and the number changes with the levels", async ({ page }) => {
  await page.goto(festivalPath);

  const section = playlistSection(page);
  await expect(section.getByText("The playlist will contain 284 songs by 149 of 150 artists.")).toBeVisible();
  await expect(section.getByRole("button", { name: "Make the playlist" })).toBeVisible();
  await expect(section.getByRole("link")).toHaveCount(0);
  // The last artist has no predicted songs, so it gives no songs.
  await expect(page.getByRole("listitem").filter({ hasText: "Broken Choir" })).toContainText("No predicted songs");

  // Must see: 7 songs. "Iron Kings" has 1 predicted song, so Must see gives 1.
  await level(page, "Ghost", "Must see").check();
  await expect(section.getByText("The playlist will contain 289 songs by 149 of 150 artists.")).toBeVisible();
  await level(page, "Iron Kings", "Must see").check();
  await level(page, "Black Choir", "Keen").check();
  await expect(section.getByText("The playlist will contain 291 songs by 149 of 150 artists.")).toBeVisible();
  await page.reload();
  await expect(section.getByText("The playlist will contain 291 songs by 149 of 150 artists.")).toBeVisible();
});

test("one action makes a private playlist “Download 2027” with the songs in the required order, then shows the link and the last update", async ({
  page,
  spotify,
  testServer,
}) => {
  await spotify.willMakePlaylist();
  await page.goto(festivalPath);
  await level(page, "Ghost", "Must see").check();
  await level(page, "Black Choir", "Keen").check();
  await level(page, "Mötley Crüe", "Not interested").check();
  await expect(playlistSection(page).getByText("The playlist will contain 289 songs by 148 of 150 artists.")).toBeVisible();

  await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();

  await expect(page.getByRole("heading", { name: "Made the playlist Download 2027 in Spotify" })).toBeVisible();
  const link = playlistSection(page).getByRole("link", { name: "Open Download 2027 in Spotify" });
  await expect(link).toHaveAttribute("href", `https://open.spotify.com/playlist/${testPlaylistId}`);
  await expect(playlistSection(page).getByText("Last update: 15 January 2027 at 12:00")).toBeVisible();
  await expect(playlistSection(page).getByRole("button", { name: "Update the playlist" })).toBeVisible();
  expect(await axeViolations(page)).toEqual([]);

  const requests = (await testServer.sentHttpRequests()).filter((request) => request.url.includes("/playlists"));
  expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
    `POST ${spotifyMyPlaylistsUrl}`,
    `PUT ${spotifyPlaylistItemsUrl(testPlaylistId)}`,
    `POST ${spotifyPlaylistItemsUrl(testPlaylistId)}`,
    `POST ${spotifyPlaylistItemsUrl(testPlaylistId)}`,
  ]);
  expect(JSON.parse(requests[0]!.body!)).toMatchObject({ name: "Download 2027", public: false });
  const uris = requests.slice(1).flatMap((request) => (JSON.parse(request.body!) as { uris: string[] }).uris);
  expect(uris).toHaveLength(289);
  // Must see (Ghost, 7 songs), then Keen (Black Choir, 4 songs), then Curious in alphabetical order: Black Echo first.
  const ghost = largeFestival.artists.findIndex((artist) => artist.name === "Ghost");
  const blackChoir = largeFestival.artists.findIndex((artist) => artist.name === "Black Choir");
  const blackEcho = largeFestival.artists.findIndex((artist) => artist.name === "Black Echo");
  expect(uris.slice(0, 13)).toEqual([
    ...[0, 1, 2, 3, 4, 5, 6].map((song) => `spotify:track:${testTrackId(ghost, song)}`),
    ...[0, 1, 2, 3].map((song) => `spotify:track:${testTrackId(blackChoir, song)}`),
    ...[0, 1].map((song) => `spotify:track:${testTrackId(blackEcho, song)}`),
  ]);

  // The Festivals page marks the festival.
  await page.getByRole("link", { name: "Festivals" }).click();
  await expect(page.getByRole("link", { name: /Download 2027/ })).toContainText("Your playlist is made");
});

test("when Spotify limits the request, the page shows the cause and the wait, and no playlist", async ({ page, spotify, testServer }) => {
  await spotify.willMakePlaylist();
  await testServer.respondTo("POST", spotifyMyPlaylistsUrl, rateLimitResponse(120));
  await page.goto(festivalPath);

  await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();

  const notice = page.getByRole("alert").filter({ hasText: "The application did not make the playlist" });
  await expect(notice).toContainText("Spotify limited the requests of the application (status 429). Try again in 2 minutes.");
  await expect(page.getByRole("heading", { name: /Made the playlist/ })).toHaveCount(0);
  await expect(playlistSection(page).getByRole("link")).toHaveCount(0);
  await expect(playlistSection(page).getByRole("button", { name: "Make the playlist" })).toBeEnabled();
  expect(await axeViolations(page)).toEqual([]);

  await page.goto("/");
  await expect(page.getByText("Your playlist is made")).toHaveCount(0);
});

test("when Spotify refuses an update, the page tells the user that the playlist did not change", async ({ page, spotify, testServer }) => {
  await spotify.willMakePlaylist();
  await page.goto(festivalPath);
  await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();
  await expect(page.getByRole("heading", { name: "Made the playlist Download 2027 in Spotify" })).toBeVisible();
  await testServer.respondTo("PUT", spotifyPlaylistItemsUrl(testPlaylistId), forbiddenResponse);

  await playlistSection(page).getByRole("button", { name: "Update the playlist" }).click();

  const notice = page.getByRole("alert").filter({ hasText: "The playlist did not change" });
  await expect(notice).toContainText("Spotify refused the request (status 403): Insufficient client scope. Try again later.");
  await expect(playlistSection(page).getByText("Last update: 15 January 2027 at 12:00")).toBeVisible();
});

test("when Spotify stops after some of the songs, the page tells the user that the playlist does not have all of the songs", async ({
  page,
  spotify,
  testServer,
}) => {
  await spotify.willMakePlaylist();
  await testServer.respondTo("POST", spotifyPlaylistItemsUrl(testPlaylistId), rateLimitResponse(120));
  await page.goto(festivalPath);

  await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "The playlist in Spotify does not have all of the songs" })).toContainText(
    "Try again in 2 minutes.",
  );
  await expect(playlistSection(page).getByRole("link", { name: "Open Download 2027 in Spotify" })).toBeVisible();
  await expect(playlistSection(page).getByText(/Last update/)).toHaveCount(0);
  expect(await axeViolations(page)).toEqual([]);

  // The notice does not stay, so the playlist panel shows the warning after a reload.
  await page.goto(festivalPath);
  await expect(playlistSection(page).getByText("Warning: the playlist in Spotify does not have all of the songs. Update the playlist.")).toBeVisible();
});

test("a playlist without songs is not made", async ({ page, testServer }) => {
  await page.goto(festivalPath);
  // Sets all 150 artists to Not interested with one request. The lineup name IDs are 1 to 150.
  const form = new URLSearchParams();
  largeFestival.artists.forEach((_, index) => form.set(`level-${index + 1}`, "not-interested"));
  const response = await page.request.post(`${festivalPath}/interest-levels`, {
    form: Object.fromEntries(form),
    headers: { origin: new URL(page.url()).origin, accept: "application/json" },
  });
  expect(response.ok()).toBe(true);
  await page.reload();
  await expect(playlistSection(page).getByText("The playlist will contain 0 songs by 0 of 150 artists.")).toBeVisible();

  await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "The playlist would contain no songs" })).toBeVisible();
  expect((await testServer.sentHttpRequests()).filter((request) => request.url.includes("/playlists"))).toEqual([]);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the user makes the playlist with the same button", async ({ page, spotify }) => {
    await spotify.willMakePlaylist();
    await page.goto(festivalPath);

    await playlistSection(page).getByRole("button", { name: "Make the playlist" }).click();

    await expect(page.getByRole("heading", { name: "Made the playlist Download 2027 in Spotify" })).toBeVisible();
    await expect(playlistSection(page).getByRole("link", { name: "Open Download 2027 in Spotify" })).toBeVisible();
  });
});
