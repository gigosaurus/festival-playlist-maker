// The standards test (STANDARDS.md section 5, step 2). It checks each page in
// the pages list for colour contrast (VS-05), page metadata (PB-04), placeholder
// text (CT-06), uppercase labels (VS-06), animation (IN-04, QA-05) and
// contractions in interface text (STE-05).
//
// Add each new page and each new page state to the pages list.
// Text that comes from a lineup source or from Spotify (for example an artist
// name) is not interface text. Put it in an element with the attribute
// data-external-text, and the text checks ignore it.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { download2027Response, incorrectKeyResponse, unknownUserResponse } from "../support/clashfinder.ts";
import { busyResponse } from "../support/musicbrainz.ts";
import { quotaExceededResponse, spotifyArtistUrl, spotifyIds } from "../support/spotify.ts";
import { matchNames } from "./artist-match-steps.ts";
import { expect, test, testAdmin, testUser, type Clashfinder, type MusicBrainz, type Spotify, type TestServer } from "./fixtures.ts";

interface StandardsPage {
  name: string;
  path: string;
  // The user that the test logs in before it opens the page. No user: the test does not log in.
  user?: typeof testUser;
  // Prepares the state of the page, after the log in.
  setUp?: (page: Page, clashfinder: Clashfinder, musicBrainz: MusicBrainz, spotify: Spotify, testServer: TestServer) => Promise<void>;
}

const downloadSearch =
  "/admin/festivals/new?name=Download&year=2027&startDate=2027-06-11&endDate=2027-06-13&expectedGenres=metal&search=";

// Adds Download 2027 with the Clashfinder page download27. The lineup response sets the result.
async function addDownload(page: Page, clashfinder: Clashfinder, lineup: typeof download2027Response): Promise<void> {
  await clashfinder.willGiveList();
  await clashfinder.willGiveLineup("download27", lineup);
  await page.goto(downloadSearch);
  await page.getByRole("radio", { name: "Download Festival 2027" }).check();
  await page.getByRole("button", { name: "Add the festival" }).click();
  await expect(page).toHaveURL(/added=/);
}

// Adds Download 2027 with its lineup, and waits for the MusicBrainz searches of its 10 names.
async function addDownloadAndSearch(page: Page, clashfinder: Clashfinder, musicBrainz: MusicBrainz): Promise<void> {
  await musicBrainz.willGiveRecordedResponses();
  await addDownload(page, clashfinder, download2027Response);
  await page.goto(artistMatches);
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Waiting for the MusicBrainz search.")).toHaveCount(0);
  }).toPass();
}

const artistMatches = "/admin/festivals/1/artist-matches";
// The lineup name IDs come from the order of the names in the Clashfinder export.
const theProdigy = 8;

// Saves the match for The Prodigy, and waits for its Spotify artist.
async function matchTheProdigy(page: Page, clashfinder: Clashfinder, musicBrainz: MusicBrainz, spotify: Spotify): Promise<void> {
  await spotify.willGiveRecordedArtists();
  await addDownloadAndSearch(page, clashfinder, musicBrainz);
  await page.getByRole("button", { name: "Save the match for The Prodigy" }).click();
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Spotify artist: waiting")).toHaveCount(0);
  }).toPass();
}

// Adds Download 2027 and matches each lineup name. The test logs in the user after this.
async function matchDownload(page: Page, clashfinder: Clashfinder, musicBrainz: MusicBrainz, spotify: Spotify): Promise<void> {
  await spotify.willGiveRecordedArtists();
  await addDownloadAndSearch(page, clashfinder, musicBrainz);
  await matchNames(page);
}

// Publishes Download 2027 as the admin, then logs in the user.
async function publishDownloadForUser(page: Page, clashfinder: Clashfinder, musicBrainz: MusicBrainz, spotify: Spotify): Promise<void> {
  await matchDownload(page, clashfinder, musicBrainz, spotify);
  await page.goto("/admin/festivals");
  await page.getByRole("button", { name: "Publish Download 2027" }).click();
  await expect(page.getByRole("heading", { name: "Published Download 2027" })).toBeVisible();
  await page.context().clearCookies();
  await spotify.willLogIn(testUser);
  await spotify.answerAuthorisation("agree");
  await page.goto("/log-in");
  await page.getByRole("button", { name: "Log in with Spotify" }).click();
  await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
}

const pages: StandardsPage[] = [
  { name: "Log in page", path: "/log-in" },
  { name: "Log in page, not on the allowlist", path: "/log-in?problem=not-on-allowlist" },
  { name: "Log in page, cancelled", path: "/log-in?problem=cancelled" },
  { name: "Log in page, failed", path: "/log-in?problem=failed" },
  { name: "Festivals page, empty state", path: "/", user: testUser },
  { name: "Page not found", path: "/no-such-page", user: testUser },
  {
    name: "Festivals page, a complete festival",
    path: "/",
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz, spotify, testServer) => {
      await publishDownloadForUser(page, clashfinder, musicBrainz, spotify);
      // Download 2027 is complete, so the page shows the section "Complete festivals".
      await testServer.setTime(new Date("2027-07-01T12:00:00Z"));
    },
  },
  {
    name: "Festival page",
    path: "/festivals/1",
    user: testAdmin,
    setUp: publishDownloadForUser,
  },
  { name: "Admin page for a user who is not the admin", path: "/admin/festivals", user: testUser },
  { name: "Manage festivals, empty state", path: "/admin/festivals", user: testAdmin },
  {
    name: "Manage festivals, festival added with its lineup",
    path: "/admin/festivals?added=1",
    user: testAdmin,
    setUp: (page, clashfinder) => addDownload(page, clashfinder, download2027Response),
  },
  {
    name: "Manage festivals, festival added without a lineup",
    path: "/admin/festivals?added=1",
    user: testAdmin,
    setUp: (page, clashfinder) => addDownload(page, clashfinder, incorrectKeyResponse),
  },
  {
    name: "Manage festivals, festival ready to publish",
    path: "/admin/festivals",
    user: testAdmin,
    setUp: matchDownload,
  },
  {
    name: "Manage festivals, festival published",
    path: "/admin/festivals?publish=1",
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz, spotify) => {
      await matchDownload(page, clashfinder, musicBrainz, spotify);
      await page.goto("/admin/festivals");
      await page.getByRole("button", { name: "Publish Download 2027" }).click();
    },
  },
  {
    name: "Manage festivals, festival not published",
    path: "/admin/festivals?publish=1",
    user: testAdmin,
    setUp: (page, clashfinder) => addDownload(page, clashfinder, download2027Response),
  },
  { name: "Add a festival", path: "/admin/festivals/new", user: testAdmin },
  { name: "Add a festival, problems", path: "/admin/festivals/new?search=", user: testAdmin },
  {
    name: "Add a festival, search results",
    path: downloadSearch,
    user: testAdmin,
    setUp: (_page, clashfinder) => clashfinder.willGiveList(),
  },
  {
    name: "Add a festival, search without results",
    path: "/admin/festivals/new?name=Glastonbury&search=",
    user: testAdmin,
    setUp: (_page, clashfinder) => clashfinder.willGiveList(),
  },
  {
    name: "Artist matches, searches complete",
    path: artistMatches,
    user: testAdmin,
    setUp: addDownloadAndSearch,
  },
  {
    name: "Artist matches, saved with a genre warning",
    path: `${artistMatches}?saved=${theProdigy}`,
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz) => {
      await addDownloadAndSearch(page, clashfinder, musicBrainz);
      await page.getByRole("button", { name: "Save the match for The Prodigy" }).click();
      await expect(page.getByText("Warning: none of the expected genres").first()).toBeVisible();
    },
  },
  {
    name: "Artist matches, search stopped",
    path: artistMatches,
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz) => {
      await musicBrainz.willGiveRecordedResponses();
      await musicBrainz.willGiveSearch("???", busyResponse);
      await addDownload(page, clashfinder, download2027Response);
      await page.goto(artistMatches);
      await expect(async () => {
        await page.reload();
        await expect(page.getByRole("button", { name: "Search again" })).toBeVisible();
      }).toPass();
    },
  },
  {
    name: "Artist match for one name",
    path: `${artistMatches}/${theProdigy}?search=Ghost`,
    user: testAdmin,
    setUp: addDownloadAndSearch,
  },
  {
    name: "Artist matches, Spotify artist set by hand",
    path: `${artistMatches}?spotify=${theProdigy}`,
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz, spotify) => {
      await matchTheProdigy(page, clashfinder, musicBrainz, spotify);
      await page.goto(`${artistMatches}/${theProdigy}/spotify`);
      await page.getByLabel("Address of the Spotify artist").fill(`https://open.spotify.com/artist/${spotifyIds.parkwayDrive}`);
      await page.getByRole("button", { name: "Save the Spotify artist" }).click();
      await expect(page.getByText("set by hand")).toBeVisible();
    },
  },
  {
    name: "Artist matches, Spotify search stopped",
    path: artistMatches,
    user: testAdmin,
    setUp: async (page, clashfinder, musicBrainz, spotify, testServer) => {
      await spotify.willGiveRecordedArtists();
      await testServer.respondTo("GET", spotifyArtistUrl(spotifyIds.theProdigy), quotaExceededResponse);
      await addDownloadAndSearch(page, clashfinder, musicBrainz);
      await page.getByRole("button", { name: "Save the match for The Prodigy" }).click();
      await expect(async () => {
        await page.reload();
        await expect(page.getByRole("button", { name: "Find the Spotify artists again" })).toBeVisible();
      }).toPass();
    },
  },
  {
    name: "Spotify artist for one name",
    path: `${artistMatches}/${theProdigy}/spotify`,
    user: testAdmin,
    setUp: matchTheProdigy,
  },
  {
    name: "Add a festival, search failed",
    path: downloadSearch,
    user: testAdmin,
    setUp: (_page, clashfinder) => clashfinder.willGiveList(unknownUserResponse),
  },
];

// The motion inventory in docs/design-spec.md. Each entry is a CSS selector for
// an element that can have an animation or a transition. It is empty: the
// application has no animation.
const motionInventory: string[] = [];

const templateNames = /vite|react app|next\.js|create-|starter|template|untitled|^document$|localhost/i;

const placeholderText =
  /lorem ipsum|\bTODO\b|\bFIXME\b|\bTBD\b|\bXXX\b|placeholder|example\.(com|org)|your (company|name|logo)|\{\{|\}\}|\bundefined\b|\bNaN\b|\[object Object\]/i;

const contraction =
  /\b[a-z]+n['’]t\b|\b[a-z]+['’](re|ve|ll|d|m)\b|\b(it|that|there|what|here|who|where|let|he|she)['’]s\b/i;

for (const { name, path, user, setUp } of pages) {
  test.describe(name, () => {
    if (user || setUp) {
      test.beforeEach(async ({ logIn, page, clashfinder, musicBrainz, spotify, testServer }) => {
        if (user) await logIn(user);
        if (setUp) await setUp(page, clashfinder, musicBrainz, spotify, testServer);
      });
    }

    test("VS-05: text has sufficient colour contrast", async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(results.violations, "Text with insufficient contrast").toEqual([]);
      // axe cannot measure some backgrounds, for example gradients and images.
      // Such text needs a check by a person, so the test fails.
      expect(results.incomplete, "Text with a background that axe cannot measure").toEqual([]);
    });

    test("PB-04: page metadata identifies the application", async ({ page, request }) => {
      await page.goto(path);

      const title = await page.title();
      expect(title).toMatch(/^.+ – Festival Playlist Maker$/);
      expect(title).not.toMatch(templateNames);

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0, "The page needs a description").toBeGreaterThan(20);
      expect(description).not.toMatch(templateNames);

      await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");

      const icon = await page.locator('link[rel="icon"]').getAttribute("href");
      expect(icon, "The page needs a browser icon").toBeTruthy();
      const iconResponse = await request.get(icon!);
      expect(iconResponse.ok()).toBe(true);
      expect(iconResponse.headers()["content-type"]).toMatch(/^image\//);
      expect(await iconResponse.text()).toContain("Festival Playlist Maker");
    });

    test("CT-06: the page has no placeholder text or generation comments", async ({ page }) => {
      await page.goto(path);

      for (const text of await interfaceText(page)) {
        expect(text, "Placeholder text").not.toMatch(placeholderText);
      }
      const comments = await page.evaluate(() => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        const found: string[] = [];
        while (walker.nextNode()) found.push(walker.currentNode.nodeValue ?? "");
        return found;
      });
      expect(comments, "HTML comments in the published page").toEqual([]);
    });

    test("VS-06: no label has uppercase text with increased letter spacing", async ({ page }) => {
      await page.goto(path);

      const uppercaseLabels = await page.evaluate(() =>
        [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()))
          .filter((element) => {
            const style = getComputedStyle(element);
            const spaced = parseFloat(style.letterSpacing) > 0;
            const text = element.innerText.trim();
            const uppercase = style.textTransform === "uppercase" || (/[A-Z]{4}/.test(text) && text === text.toUpperCase());
            return spaced && uppercase;
          })
          .map((element) => element.outerHTML.slice(0, 120)),
      );
      expect(uppercaseLabels).toEqual([]);
    });

    test("IN-04: each animation is in the motion inventory", async ({ page }) => {
      await page.goto(path);

      const unlisted = await page.evaluate((inventory) => {
        const listed = (element: Element) => inventory.some((selector) => element.matches(selector));
        const hasMotion = (element: Element) => {
          const style = getComputedStyle(element);
          const nonZero = (durations: string) => durations.split(",").some((duration) => parseFloat(duration) > 0);
          const animation = style.animationName !== "none" && nonZero(style.animationDuration);
          return animation || nonZero(style.transitionDuration);
        };
        return [...document.querySelectorAll("*")]
          .filter((element) => hasMotion(element) && !listed(element))
          .map((element) => element.outerHTML.slice(0, 120));
      }, motionInventory);
      expect(unlisted, "Elements with an animation that is not in the motion inventory").toEqual([]);
    });

    test("QA-05: no animation runs when the user sets reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);

      const running = await page.evaluate(() =>
        document.getAnimations().map((animation) => String(animation.id || animation.constructor.name)),
      );
      expect(running).toEqual([]);
    });

    test("STE-05: interface text has no contractions", async ({ page }) => {
      await page.goto(path);

      for (const text of await interfaceText(page)) {
        expect(text, "A contraction in interface text").not.toMatch(contraction);
      }
    });
  });
}

// The text that the application wrote: visible text, text for assistive
// technology and the page metadata. Text from external services is not included.
async function interfaceText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts: string[] = [document.title];
    const description = document.querySelector('meta[name="description"]')?.getAttribute("content");
    if (description) texts.push(description);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, [data-external-text]")) continue;
      if (node.textContent!.trim()) texts.push(node.textContent!.trim());
    }

    for (const element of document.body.querySelectorAll("[alt], [title], [aria-label], [placeholder], input[value]")) {
      if (element.closest("[data-external-text]")) continue;
      for (const attribute of ["alt", "title", "aria-label", "placeholder", "value"]) {
        const value = element.getAttribute(attribute);
        if (value) texts.push(value);
      }
    }
    return texts;
  });
}
