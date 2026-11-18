// Tests of the Clashfinder lineup source with recorded Clashfinder responses.
// When the Clashfinder API changes, record the responses again
// (test/fixtures/clashfinder/README.md). A failing test then shows the change.
import assert from "node:assert/strict";
import { test } from "node:test";
import { clashfinderListLifetime, createClashfinder, maximumResults } from "../../src/clashfinder.ts";
import { withServiceRules } from "../../src/http-client.ts";
import type { ClashfinderSettings } from "../../src/lineup-source.ts";
import {
  download2027Response,
  incorrectKeyResponse,
  listResponse,
  signedExportUrl,
  signedListUrl,
  slamDunk2026Response,
  unknownPageResponse,
  unknownUserResponse,
} from "../support/clashfinder.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { testSettings } from "../support/test-settings.ts";

function setUp() {
  const transport = new FakeHttpClient();
  const clock = new FakeClock(new Date("2026-11-18T17:00:00Z"));
  const clashfinder = createClashfinder(withServiceRules(transport, testSettings(), clock), clock);
  return { transport, clock, clashfinder };
}

function settings(page: string): ClashfinderSettings {
  return { source: "clashfinder", page, pageName: page };
}

test("getLineup gives each act of a Clashfinder page with its stage and set times", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("slamdunk2026"), slamDunk2026Response);

  const result = await clashfinder.getLineup(settings("slamdunk2026"));

  assert.equal(result.outcome, "got");
  if (result.outcome !== "got") return;
  assert.equal(result.lineup.timezone, "Europe/London");
  assert.equal(result.lineup.entries.length, 122);
  assert.equal(new Set(result.lineup.entries.map((entry) => entry.name)).size, 62);
  assert.deepEqual(
    result.lineup.entries.filter((entry) => entry.name === "Knocked Loose"),
    [
      { name: "Knocked Loose", stage: "Main Stage East Right", start: "2026-05-23T21:05", end: "2026-05-23T22:05" },
      { name: "Knocked Loose", stage: "Main Stage East Right", start: "2026-05-24T21:05", end: "2026-05-24T22:05" },
    ],
  );
  // Clashfinder gives no day. The day stays empty, so that version 2 can decide it.
  assert.ok(result.lineup.entries.every((entry) => entry.day === undefined));
});

test("getLineup keeps the names as Clashfinder gives them, also names that are not artists", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("download27"), download2027Response);

  const result = await clashfinder.getLineup(settings("download27"));

  assert.equal(result.outcome, "got");
  if (result.outcome !== "got") return;
  const names = [...new Set(result.lineup.entries.map((entry) => entry.name))];
  // The admin marks "???" as "no match" (#7).
  assert.ok(names.includes("???"));
  assert.ok(names.includes("Mötley Crüe"));
  assert.equal(names.length, 10);
});

test("getLineup gives the cause when Clashfinder refuses the API key", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("download27"), incorrectKeyResponse);

  const result = await clashfinder.getLineup(settings("download27"));

  assert.deepEqual(result, {
    outcome: "failed",
    cause:
      "Clashfinder refused the API key (status 401): authPublicKey incorrect. Check CLASHFINDER_USERNAME and CLASHFINDER_PRIVATE_KEY in the .env file.",
  });
});

test("getLineup gives the cause for a page that does not exist, without the server path", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("no-such-page-fpm"), unknownPageResponse);

  const result = await clashfinder.getLineup(settings("no-such-page-fpm"));

  assert.deepEqual(result, { outcome: "failed", cause: 'Clashfinder does not have the page "no-such-page-fpm" (status 404).' });
});

test("getLineup fails with a clear cause when the response has a different structure", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("download27"), { body: '{"name":"Download Festival 2027","acts":[]}' });

  const result = await clashfinder.getLineup(settings("download27"));

  assert.equal(result.outcome, "failed");
  assert.match(result.outcome === "failed" ? result.cause : "", /no "locations" list\. The Clashfinder API possibly changed/);
});

test("getLineup fails when the page has no lineup names, so that the previous lineup stays", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedExportUrl("download27"), {
    body: '{"name":"Download Festival 2027","timezone":"Europe/London","locations":[{"name":"Apex","events":[]}]}',
  });

  const result = await clashfinder.getLineup(settings("download27"));

  assert.deepEqual(result, { outcome: "failed", cause: "The Clashfinder page has no lineup names." });
});

test("getLineup gives the cause when the network fails", async () => {
  const { clashfinder } = setUp();

  // The fake HTTP client has no response, so the request fails.
  const result = await clashfinder.getLineup(settings("download27"));

  assert.equal(result.outcome, "failed");
  assert.match(result.outcome === "failed" ? result.cause : "", /^The application could not connect to Clashfinder: /);
});

test("search finds the pages that match the festival name, the pages on the festival dates first", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  const result = await clashfinder.search("Slam Dunk", { start: "2026-05-23", end: "2026-05-24" });

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  // The five pages that start on the festival dates come first, by start date.
  // Then the pages of other years, by distance from the start date.
  assert.deepEqual(
    result.nameMatches.map((page) => `${page.id} ${page.startDate}`),
    [
      "slamdunk2026 2026-05-23",
      "sdhat2026 2026-05-23",
      "slamdunk2026predictions 2026-05-23",
      "slamdunkleeds2026 2026-05-24",
      "sdnorth 2026-05-24",
      "slamdunknorthtwentytwentyfive 2025-05-25",
      "slamdunk25 2025-05-25",
      "sd25 2025-05-24",
      "slamdunkfestivalsouth2025 2025-05-24",
      "slamdunk2027 2027-05-29",
      "sdhat2027 2027-05-30",
    ],
  );
  assert.deepEqual(result.nameMatches.find((page) => page.id === "slamdunk2026"), {
    id: "slamdunk2026",
    name: "Slam Dunk 2026",
    startDate: "2026-05-23",
    days: 2,
    stages: 8,
    acts: 62,
    lastEdit: "2026-05-22",
    core: true,
    official: false,
  });
});

test("search shows the pages with a different name that start on the festival dates", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  const result = await clashfinder.search("Download", { start: "2027-06-11", end: "2027-06-13" });

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.equal(result.nameMatches[0]!.id, "download27");
  const dateMatches = result.dateMatches.map((page) => page.id);
  // A page for a festival can have a name such as "DLXXIV". The recorded list has
  // no such page, but these two pages with different names start on 11 June 2027.
  // Pages that start on 10 June 2027 (one day before) are not included. The page with more acts is first.
  assert.deepEqual(dateMatches, ["draftangie", "pentafest"]);
  assert.equal(result.dateMatchCount, 2);
});

test("search finds a page from its Clashfinder address or its ID", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  const fromAddress = await clashfinder.search("https://clashfinder.com/s/dl2026sf/", undefined);
  const fromId = await clashfinder.search("download2k26", undefined);

  assert.equal(fromAddress.outcome === "found" && fromAddress.nameMatches[0]!.id, "dl2026sf");
  assert.equal(fromId.outcome === "found" && fromId.nameMatches[0]!.id, "download2k26");
});

test("search ignores case and accents, and gives no more than the maximum number of pages", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  const result = await clashfinder.search("DÖWNLOAD", undefined);

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.ok(result.nameMatches.length > 5 && result.nameMatches.length <= maximumResults);
  assert.deepEqual(result.dateMatches, [], "No date matches without festival dates");
});

test("search gives no pages for a name that no page has", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  const result = await clashfinder.search("Glastonbury", { start: "2030-06-24", end: "2030-06-28" });

  assert.deepEqual(result, { outcome: "found", nameMatches: [], dateMatches: [], dateMatchCount: 0 });
});

test("search keeps the list of pages for one hour", async () => {
  const { transport, clock, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, listResponse);

  await clashfinder.search("Download", undefined);
  clock.advance(clashfinderListLifetime - 1);
  await clashfinder.search("Bloodstock", undefined);
  assert.equal(transport.requests.length, 1);
  assert.equal(clashfinder.cachedPage("boa25")?.name, "Bloodstock Open Air 2025");

  clock.advance(1);
  await clashfinder.search("Bloodstock", undefined);
  assert.equal(transport.requests.length, 2);
});

test("search gives the cause when Clashfinder refuses the username", async () => {
  const { transport, clashfinder } = setUp();
  transport.respondTo("GET", signedListUrl, unknownUserResponse);

  const result = await clashfinder.search("Download", undefined);

  assert.deepEqual(result, {
    outcome: "failed",
    cause:
      "Clashfinder refused the API key (status 401): User not found: nobody-here. Check CLASHFINDER_USERNAME and CLASHFINDER_PRIVATE_KEY in the .env file.",
  });
});
