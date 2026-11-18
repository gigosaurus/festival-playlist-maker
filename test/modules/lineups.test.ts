import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { addFestival, findFestivalForAdmin, listFestivalsForAdmin } from "../../src/festivals.ts";
import type { LineupResult, LineupSource } from "../../src/lineup-source.ts";
import { currentLineup, getFestivalLineup } from "../../src/lineups.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

const download = {
  name: "Download",
  year: 2027,
  startDate: "2027-06-11",
  endDate: "2027-06-13",
  expectedGenres: ["metal", "hard rock"],
  page: "download27",
};

// A lineup source that gives the results in the order that the test sets.
function sourceWith(...results: LineupResult[]): LineupSource {
  return { getLineup: async () => results.shift()! };
}

function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock(new Date("2026-11-18T17:10:00Z"));
  const added = addFestival(database, download, { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" });
  assert.equal(added.outcome, "added");
  return { database, clock, id: added.outcome === "added" ? added.id : 0 };
}

const firstLineup: LineupResult = {
  outcome: "got",
  lineup: {
    timezone: "Europe/London",
    entries: [
      { name: "Turnstile", stage: "Apex", start: "2027-06-12T19:00", end: "2027-06-12T20:10" },
      { name: "Evanescence", stage: "Apex", start: "2027-06-13T21:20", end: "2027-06-13T23:00" },
      { name: "Evanescence", stage: "Opus", start: "2027-06-11T18:00" },
      { name: "Special guest" },
    ],
  },
};

test("addFestival stores the festival with its expected genres and lineup source", (t) => {
  const { database, id } = setUp(t);

  const festival = findFestivalForAdmin(database, id);

  assert.deepEqual(festival, {
    id,
    name: "Download",
    year: 2027,
    startDate: "2027-06-11",
    endDate: "2027-06-13",
    published: false,
    expectedGenres: ["metal", "hard rock"],
    lineupSource: { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" },
    lineupNames: 0,
  });
});

test("addFestival refuses a second festival with the same name and year", (t) => {
  const { database } = setUp(t);

  const result = addFestival(database, { ...download, expectedGenres: ["rock"] }, {
    source: "clashfinder",
    page: "dl2026sf",
    pageName: "Download 2026",
  });

  assert.deepEqual(result, { outcome: "exists" });
  assert.equal(listFestivalsForAdmin(database).length, 1);
});

test("getFestivalLineup stores each lineup name once, with all of its stages and set times", async (t) => {
  const { database, clock, id } = setUp(t);

  await getFestivalLineup(database, sourceWith(firstLineup), clock, id);

  assert.deepEqual(currentLineup(database, id), [
    {
      name: "Evanescence",
      firstSeen: "2026-11-18T17:10:00.000Z",
      lastSeen: "2026-11-18T17:10:00.000Z",
      times: [
        { day: null, stage: "Opus", start: "2027-06-11T18:00", end: null },
        { day: null, stage: "Apex", start: "2027-06-13T21:20", end: "2027-06-13T23:00" },
      ],
    },
    { name: "Special guest", firstSeen: "2026-11-18T17:10:00.000Z", lastSeen: "2026-11-18T17:10:00.000Z", times: [] },
    {
      name: "Turnstile",
      firstSeen: "2026-11-18T17:10:00.000Z",
      lastSeen: "2026-11-18T17:10:00.000Z",
      times: [{ day: null, stage: "Apex", start: "2027-06-12T19:00", end: "2027-06-12T20:10" }],
    },
  ]);
  const festival = findFestivalForAdmin(database, id)!;
  assert.equal(festival.lineupNames, 3);
  assert.deepEqual(festival.lineupUpdatedAt, new Date("2026-11-18T17:10:00Z"));
  assert.equal(festival.lineupProblem, undefined);
  const { lineup_timezone } = database.prepare("SELECT lineup_timezone FROM festival WHERE id = ?").get(id) as { lineup_timezone: string };
  assert.equal(lineup_timezone, "Europe/London");
});

test("a lineup source failure keeps the previous lineup and records the time and the cause", async (t) => {
  const { database, clock, id } = setUp(t);
  await getFestivalLineup(database, sourceWith(firstLineup), clock, id);
  clock.advance(60_000);

  const result = await getFestivalLineup(
    database,
    sourceWith({ outcome: "failed", cause: "Clashfinder refused the API key (status 401): authPublicKey incorrect." }),
    clock,
    id,
  );

  assert.equal(result.outcome, "failed");
  const festival = findFestivalForAdmin(database, id)!;
  assert.equal(festival.lineupNames, 3);
  assert.deepEqual(festival.lineupUpdatedAt, new Date("2026-11-18T17:10:00Z"));
  assert.deepEqual(festival.lineupProblem, {
    at: new Date("2026-11-18T17:11:00Z"),
    cause: "Clashfinder refused the API key (status 401): authPublicKey incorrect.",
  });
  assert.deepEqual(
    currentLineup(database, id).map((name) => name.name),
    ["Evanescence", "Special guest", "Turnstile"],
  );
});

test("a new lineup replaces the current lineup and keeps the first-seen time of each name", async (t) => {
  const { database, clock, id } = setUp(t);
  await getFestivalLineup(database, sourceWith(firstLineup), clock, id);
  await getFestivalLineup(database, sourceWith({ outcome: "failed", cause: "Network failure." }), clock, id);
  clock.advance(24 * 60 * 60_000);

  await getFestivalLineup(
    database,
    sourceWith({ outcome: "got", lineup: { entries: [{ name: "Turnstile", stage: "Apex" }, { name: "Gojira" }] } }),
    clock,
    id,
  );

  const lineup = currentLineup(database, id);
  assert.deepEqual(
    lineup.map(({ name, firstSeen, lastSeen }) => ({ name, firstSeen, lastSeen })),
    [
      { name: "Gojira", firstSeen: "2026-11-19T17:10:00.000Z", lastSeen: "2026-11-19T17:10:00.000Z" },
      { name: "Turnstile", firstSeen: "2026-11-18T17:10:00.000Z", lastSeen: "2026-11-19T17:10:00.000Z" },
    ],
  );
  assert.deepEqual(lineup[1]!.times, [{ day: null, stage: "Apex", start: null, end: null }]);
  assert.equal(findFestivalForAdmin(database, id)!.lineupProblem, undefined, "A successful attempt removes the problem");
});
