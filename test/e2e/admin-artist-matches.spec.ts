import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { clashfinderCrawlDelay, musicbrainzRequestDelay } from "../../src/http-client.ts";
import { download2027Response } from "../support/clashfinder.ts";
import { busyResponse, genreListUrl, musicbrainzSearchUrl, searchResponse } from "../support/musicbrainz.ts";
import { artistResponse, quotaExceededResponse, spotifyArtistUrl, spotifyIds } from "../support/spotify.ts";
import { expect, test, testAdmin, type Clashfinder } from "./fixtures.ts";

// Adds a festival with the Clashfinder page download27 (10 lineup names).
async function addFestival(page: Page, clashfinder: Clashfinder, name = "Download"): Promise<void> {
  await clashfinder.willGiveList();
  await clashfinder.willGiveLineup("download27", download2027Response);
  await page.goto(
    `/admin/festivals/new?name=${name}&year=2027&startDate=2027-06-11&endDate=2027-06-13&expectedGenres=metal,+hard+rock&search=Download`,
  );
  await page.getByRole("radio", { name: "Download Festival 2027" }).check();
  await page.getByRole("button", { name: "Add the festival" }).click();
  await expect(page).toHaveURL(/added=/);
}

// The searches run in the background. The admin loads the page again to see new results.
async function waitForSearches(page: Page): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Waiting for the MusicBrainz search.")).toHaveCount(0);
  }).toPass();
}

async function openArtistMatches(page: Page, festival = "Download 2027"): Promise<void> {
  await page.goto("/admin/festivals");
  await page
    .getByRole("article", { name: festival })
    .getByRole("link", { name: /^(Match the artists|Show the artist matches) for/ })
    .click();
  await waitForSearches(page);
}

// The Spotify artists are found in the background. The admin loads the page again to see them.
async function waitForSpotifyArtists(page: Page): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Spotify artist: waiting")).toHaveCount(0);
  }).toPass();
}

function matchRow(page: Page, name: string) {
  return page.getByRole("region", { name: /^Artist matches/ }).getByRole("listitem").filter({ hasText: name });
}

function lineupName(page: Page, name: string) {
  return page.getByRole("article", { name, exact: true });
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

  test("the admin confirms the proposed artist with one action", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await expect(page.getByRole("article", { name: "Download 2027" })).toContainText("10 lineup names have no artist match.");

    await openArtistMatches(page);

    await expect(page).toHaveTitle("Artist matches for Download 2027 – Festival Playlist Maker");
    await expect(page.getByRole("heading", { name: "Names without an artist match (10)" })).toBeVisible();
    const name = lineupName(page, "Bring Me The Horizon");
    const proposed = name.getByRole("radio", { name: "Bring Me the Horizon Proposed" });
    await expect(proposed).toBeChecked();
    // The facts that tell artists with the same name apart (user story 57).
    const choice = name.getByRole("listitem").filter({ has: page.getByRole("radio", { name: "Bring Me the Horizon Proposed" }) });
    await expect(choice).toContainText("Group · United Kingdom · Active from 2004");
    await expect(choice).toContainText("Genres: metalcore, alternative rock, alternative metal, deathcore, pop rock");
    await expect(choice.getByRole("link", { name: "Open Bring Me the Horizon on MusicBrainz" })).toHaveAttribute(
      "href",
      "https://musicbrainz.org/artist/074e3847-f67f-49f9-81f1-8c8cea147e8e",
    );
    // The proposal and "No match" show first. The other possible artists are in a closed group.
    await expect(name.getByRole("radio")).toHaveCount(2);
    await name.getByText("Show 4 other artists").click();
    await expect(name.getByRole("radio")).toHaveCount(6);
    await expect(name.getByRole("radio", { name: "Matt Nicholls" })).toHaveAccessibleDescription(
      /Bring Me the Horizon drummer.*Warning: no genres on MusicBrainz/,
    );
    expect(await axeViolations(page)).toEqual([]);

    await name.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await expect(page.getByRole("heading", { name: "Matched Bring Me The Horizon to Bring Me the Horizon" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Names without an artist match (9)" })).toBeVisible();
    await expect(lineupName(page, "Bring Me The Horizon")).toHaveCount(0);
    const matches = page.getByRole("region", { name: "Artist matches (1)" });
    await expect(matches).toContainText(/Bring Me The Horizon\s+Bring Me the Horizon · Group · United Kingdom · Active from 2004/);
    await page.goto("/admin/festivals");
    await expect(page.getByRole("article", { name: "Download 2027" })).toContainText("9 lineup names have no artist match.");
  });

  test("the HTTP client sends the MusicBrainz requests at a maximum of 1 each second", async ({ page, clashfinder, testServer }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);

    const requests = (await testServer.sentHttpRequests()).filter(({ url }) => url.startsWith("https://musicbrainz.org/"));
    expect(requests[0]!.url).toBe(genreListUrl);
    expect(requests).toHaveLength(11);
    expect(requests.map(({ url }) => url)).toContain(musicbrainzSearchUrl("Mötley Crüe"));
    // The Clashfinder crawl delay, then 1 second before each MusicBrainz request after the first.
    expect(await testServer.sleeps()).toEqual([clashfinderCrawlDelay, ...Array(10).fill(musicbrainzRequestDelay)]);
  });

  test("a match to an artist with no expected genre shows a warning and is saved", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    await expect(page.getByText("Expected genres metal, hard rock")).toBeVisible();
    const prodigy = lineupName(page, "The Prodigy");
    await expect(prodigy.getByRole("radio", { name: "The Prodigy Proposed" })).toHaveAccessibleDescription(
      /Warning: none of the expected genres/,
    );

    await prodigy.getByRole("button", { name: "Save the match for The Prodigy" }).click();

    await expect(page.getByRole("heading", { name: "Matched The Prodigy to The Prodigy" })).toBeVisible();
    await expect(page.getByText("Warning: none of the expected genres. Make sure that it is the correct artist.")).toBeVisible();
    const matches = page.getByRole("region", { name: "Artist matches (1)" });
    await expect(matches).toContainText("The Prodigy");
    await expect(matches).toContainText("Warning: none of the expected genres");
  });

  test("the matches with a genre warning are first in the list of matches", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    for (const name of ["Bring Me The Horizon", "Evanescence", "The Prodigy"]) {
      await page.getByRole("button", { name: `Save the match for ${name}` }).click();
    }

    const matches = page.getByRole("region", { name: "Artist matches (3)" });
    await expect(matches).toContainText("1 match has a genre warning. It is first in the list.");
    await expect(matches.getByRole("listitem").first()).toContainText("The Prodigy");
  });

  test("the application proposes “no match” for a placeholder name", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    const placeholder = lineupName(page, "???");
    await expect(placeholder.getByRole("radio", { name: "No match Proposed" })).toBeChecked();

    await placeholder.getByRole("button", { name: "Save the match for ???" }).click();

    await expect(page.getByRole("heading", { name: "Marked ??? “no match”" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Artist matches (1)" })).toContainText(/\?\?\?\s+No match/);
  });

  test("the admin changes a match with a different search text", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await page.getByRole("link", { name: "Change the match for Bring Me The Horizon" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Artist match for Bring Me The Horizon");
    await expect(page.getByRole("radio", { name: "Bring Me the Horizon Current match" })).toBeChecked();
    await page.getByLabel("Name or address of the MusicBrainz artist").fill("BMTH");
    await page.getByRole("button", { name: "Search MusicBrainz" }).click();
    await expect(page).toHaveURL(/search=BMTH/);
    await expect(page.getByRole("heading", { name: "Artists that match “BMTH”" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Bring Me the Horizon Current match" })).toBeChecked();
    expect(await axeViolations(page)).toEqual([]);

    await page.getByRole("radio", { name: "Bring Me the Horizon UK" }).check();
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await expect(page.getByRole("heading", { name: "Matched Bring Me The Horizon to Bring Me the Horizon UK" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Artist matches (1)" })).toContainText("Bring Me the Horizon UK · tribute");
  });

  test("a save without a choice shows the problem", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    await lineupName(page, "Turnstile").getByRole("link", { name: "Search with a different text for Turnstile" }).click();
    await page.getByLabel("Name or address of the MusicBrainz artist").fill("Ghost");
    await page.getByRole("button", { name: "Search MusicBrainz" }).click();
    // No artist named "Ghost" has the lineup name "Turnstile", so nothing is proposed.
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Save the match for Turnstile" }).click();

    await expect(page).toHaveTitle("Error: Artist match for Turnstile – Festival Playlist Maker");
    await expect(page.getByText("Choose an artist or “No match”.")).toBeVisible();
  });

  test("a lineup name that has a match from a different festival gets that match", async ({ page, clashfinder }) => {
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await addFestival(page, clashfinder, "Download Warm Up");

    await expect(page.getByRole("article", { name: "Download Warm Up 2027" })).toContainText("9 lineup names have no artist match.");
    await openArtistMatches(page, "Download Warm Up 2027");
    await expect(lineupName(page, "Bring Me The Horizon")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Artist matches (1)" })).toContainText("Bring Me the Horizon · Group");
  });

  test("a failed search stops the searches, and the admin starts them again", async ({ page, clashfinder, musicBrainz }) => {
    await musicBrainz.willGiveSearch("Evanescence", busyResponse);
    await addFestival(page, clashfinder);
    await page.goto("/admin/festivals/1/artist-matches");
    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: /^The MusicBrainz search stopped on / })).toBeVisible();
    }).toPass();
    await expect(page.getByText("MusicBrainz was busy and refused the request 3 times (status 503). Try again in some minutes.")).toBeVisible();
    await expect(lineupName(page, "Evanescence")).toContainText("Waiting for the MusicBrainz search.");

    await musicBrainz.willGiveSearch("Evanescence", searchResponse("Evanescence"));
    await page.getByRole("button", { name: "Search again" }).click();
    await waitForSearches(page);

    await expect(lineupName(page, "Evanescence").getByRole("radio", { name: "Evanescence Proposed" })).toBeChecked();
    await expect(page.getByRole("button", { name: "Search again" })).toHaveCount(0);
  });
});

test.describe("Spotify artist", () => {
  test.beforeEach(async ({ page, logIn, musicBrainz, spotify, clashfinder }) => {
    await logIn(testAdmin);
    await musicBrainz.willGiveRecordedResponses();
    await spotify.willGiveRecordedArtists();
    await addFestival(page, clashfinder);
    await openArtistMatches(page);
  });

  test("the admin sees the Spotify artist of a match, with a link that opens it in Spotify", async ({ page }) => {
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await waitForSpotifyArtists(page);

    const row = matchRow(page, "Bring Me The Horizon");
    await expect(row).toContainText(/Spotify artist: Bring Me The Horizon in Spotify\s+· from the MusicBrainz link/);
    const link = row.getByRole("link", { name: "Bring Me The Horizon in Spotify" });
    await expect(link).toHaveAttribute("href", `https://open.spotify.com/artist/${spotifyIds.bringMeTheHorizon}`);
    await expect(link).toHaveAttribute("target", "_blank");
    expect(await axeViolations(page)).toEqual([]);
  });

  test("a match to an artist without a Spotify artist shows a warning", async ({ page }) => {
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();
    await page.getByRole("link", { name: "Change the match for Bring Me The Horizon" }).click();
    await page.getByRole("radio", { name: "Bring Me the Horizon UK" }).check();
    await page.getByRole("button", { name: "Save the match for Bring Me The Horizon" }).click();

    await waitForSpotifyArtists(page);

    // The tribute band has no MusicBrainz Spotify link, and the Spotify search gives only the real band.
    await expect(matchRow(page, "Bring Me The Horizon")).toContainText(
      "Warning: no Spotify artist found. Playlists get no songs for this artist.",
    );
  });

  test("the admin sets the Spotify artist by hand, and a new save of the match does not replace it", async ({ page }) => {
    await page.getByRole("button", { name: "Save the match for Turnstile" }).click();
    await waitForSpotifyArtists(page);
    await expect(matchRow(page, "Turnstile")).toContainText(/Spotify artist: Turnstile in Spotify\s+· from the MusicBrainz link/);

    await page.getByRole("link", { name: "Set the Spotify artist for Turnstile" }).click();

    await expect(page).toHaveTitle("Spotify artist for Turnstile – Festival Playlist Maker");
    await expect(page.getByText("Current Spotify artist")).toBeVisible();
    expect(await axeViolations(page)).toEqual([]);
    const address = page.getByLabel("Address of the Spotify artist");
    await address.fill(`https://open.spotify.com/album/${spotifyIds.turnstile}`);
    await page.getByRole("button", { name: "Save the Spotify artist" }).click();
    await expect(page).toHaveTitle("Error: Spotify artist for Turnstile – Festival Playlist Maker");
    await expect(address).toHaveAccessibleDescription(/Enter the address of a Spotify artist/);
    expect(await axeViolations(page)).toEqual([]);

    await address.fill(`https://open.spotify.com/artist/${spotifyIds.ghostSweden}?si=0123456789`);
    await page.getByRole("button", { name: "Save the Spotify artist" }).click();

    await expect(page.getByRole("heading", { name: "Set the Spotify artist of Turnstile to Ghost" })).toBeVisible();
    await expect(matchRow(page, "Turnstile")).toContainText(/Spotify artist: Ghost in Spotify\s+· set by hand/);

    // A new save of the match finds the Spotify artist again. It does not replace the artist that the admin set.
    await page.getByRole("link", { name: "Change the match for Turnstile" }).click();
    await page.getByRole("button", { name: "Save the match for Turnstile" }).click();
    await waitForSpotifyArtists(page);
    await expect(matchRow(page, "Turnstile")).toContainText(/Spotify artist: Ghost in Spotify\s+· set by hand/);
  });

  test("an address that Spotify does not have shows the problem", async ({ page, testServer }) => {
    await page.getByRole("button", { name: "Save the match for Turnstile" }).click();
    await waitForSpotifyArtists(page);
    await testServer.respondTo("GET", spotifyArtistUrl("0000000000000000000000"), {
      status: 404,
      body: '{"error":{"status":404,"message":"Resource not found"}}',
    });
    await page.getByRole("link", { name: "Set the Spotify artist for Turnstile" }).click();

    await page.getByLabel("Address of the Spotify artist").fill("spotify:artist:0000000000000000000000");
    await page.getByRole("button", { name: "Save the Spotify artist" }).click();

    await expect(page.getByText("Spotify has no artist at this address. Make sure that you copied the full address.")).toBeVisible();
    await expect(page.getByLabel("Address of the Spotify artist")).toHaveValue("spotify:artist:0000000000000000000000");
  });

  test("a name with “no match” has no Spotify artist page", async ({ page }) => {
    await page.getByRole("button", { name: "Save the match for ???" }).click();
    await expect(matchRow(page, "???").getByRole("link", { name: /Set the Spotify artist/ })).toHaveCount(0);

    // The lineup name IDs come from the order of the names in the Clashfinder export. "???" is first.
    const response = await page.goto("/admin/festivals/1/artist-matches/1/spotify");

    expect(response?.status()).toBe(404);
  });

  test("a Spotify quota error stops the search with its cause, and the admin starts it again", async ({ page, testServer }) => {
    await testServer.respondTo("GET", spotifyArtistUrl(spotifyIds.evanescence), quotaExceededResponse);
    await page.getByRole("button", { name: "Save the match for Evanescence" }).click();

    await expect(async () => {
      await page.reload();
      await expect(page.getByRole("heading", { name: /^The search for Spotify artists stopped on / })).toBeVisible();
    }).toPass();
    await expect(page.getByText(/used all of its Spotify quota \(status 429, QUOTA_EXCEEDED\)/)).toBeVisible();
    await expect(matchRow(page, "Evanescence")).toContainText("Spotify artist: waiting");

    await testServer.respondTo("GET", spotifyArtistUrl(spotifyIds.evanescence), artistResponse(spotifyIds.evanescence));
    await page.getByRole("button", { name: "Find the Spotify artists again" }).click();
    await waitForSpotifyArtists(page);

    await expect(matchRow(page, "Evanescence")).toContainText(/Spotify artist: Evanescence in Spotify\s+· from the MusicBrainz link/);
  });
});

test("a user who is not the admin cannot open the artist matches", async ({ page, logIn }) => {
  await logIn();

  await page.goto("/admin/festivals/1/artist-matches");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Only the admin can open this page");
  for (const path of [
    "/admin/festivals/1/artist-matches",
    "/admin/festivals/1/artist-matches/search",
    "/admin/festivals/1/artist-matches/spotify",
    "/admin/festivals/1/artist-matches/1/spotify",
  ]) {
    const response = await page.request.post(path, { form: { lineupName: "1", choice: "no-match" } });
    expect(response.status(), path).toBe(403);
  }
});

test("the admin saves the proposed artist with the keyboard only", async ({ page, logIn, clashfinder, musicBrainz }) => {
  await logIn(testAdmin);
  await musicBrainz.willGiveRecordedResponses();
  await addFestival(page, clashfinder);
  await openArtistMatches(page);

  // The first name is "???". Its first control is the "No match" radio button, then
  // the closed group, then "Save the match".
  const save = page.getByRole("button", { name: "Save the match for ???" });
  for (let presses = 0; presses < 30 && !(await save.evaluate((element) => element === document.activeElement)); presses++) {
    await page.keyboard.press("Tab");
  }
  await expect(save).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Marked ??? “no match”" })).toBeVisible();
});

test.describe("unknown addresses", () => {
  test.beforeEach(async ({ logIn }) => {
    await logIn(testAdmin);
  });

  // Lineup name 1 is on no lineup, because there is no festival.
  for (const path of [
    "/admin/festivals/99/artist-matches",
    "/admin/festivals/1/artist-matches/99",
    "/admin/festivals/abc/artist-matches",
    "/admin/festivals/1/artist-matches/1/spotify",
  ]) {
    test(`${path} shows Page not found`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    });
  }
});
