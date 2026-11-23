import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { saveArtistMatch } from "../../src/artist-matches.ts";
import { openDatabase, type Database } from "../../src/database.ts";
import { addFestival, changeLineupSource, findFestivalForAdmin, listPublishedFestivals, publishFestival } from "../../src/festivals.ts";
import { checkDueLineups, dueFestivals, maximumChecksInRun } from "../../src/lineup-check.ts";
import type { LineupResult } from "../../src/lineup-source.ts";
import { currentLineup, getFestivalLineup, lastLineupChange } from "../../src/lineups.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

const hour = 60 * 60_000;
const day = 24 * hour;

function lineupOf(...names: string[]): LineupResult {
  return { outcome: "got", lineup: { entries: names.map((name) => ({ name })) } };
}

// A database with Download 2027 (11 to 13 June 2027), published with a lineup of 3 names.
// The lineup source gives the results that the test puts in `results`, in order.
async function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock(new Date("2027-06-01T09:00:00Z"));
  const results: LineupResult[] = [];
  const source = { getLineup: async () => results.shift() ?? { outcome: "failed" as const, cause: "No result." } };
  const id = await addPublished(database, clock, "Download", "2027-06-11", ["Ghost", "Gojira", "Turnstile"]);
  const check = () => checkDueLineups(database, clock, (festivalId) => getFestivalLineup(database, source, clock, festivalId));
  return { database, clock, results, id, check };
}

async function addPublished(database: Database, clock: FakeClock, name: string, startDate: string, names: string[]): Promise<number> {
  const added = addFestival(
    database,
    { name, year: 2027, startDate, endDate: startDate, expectedGenres: ["metal"], page: name.toLowerCase() },
    { source: "clashfinder", page: name.toLowerCase(), pageName: name },
  );
  assert.equal(added.outcome, "added");
  const id = added.outcome === "added" ? added.id : 0;
  await getFestivalLineup(database, { getLineup: async () => lineupOf(...names) }, clock, id);
  for (const each of names) saveArtistMatch(database, clock, each, { kind: "no-match" });
  assert.deepEqual(publishFestival(database, id), { outcome: "published" });
  return id;
}

test("the first lineup of a festival records no new names", async (t) => {
  const { database, id } = await setUp(t);

  assert.equal(lastLineupChange(database, id), undefined);
});

test("the check records the new names and the removed names with the time of the check", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push(lineupOf("Ghost", "Turnstile", "Bring Me the Horizon", "Architects"));

  await check();

  assert.deepEqual(lastLineupChange(database, id), {
    at: new Date("2027-06-02T09:00:00Z"),
    newNames: [
      { lineupNameId: lineupNameId(database, id, "Architects"), name: "Architects" },
      { lineupNameId: lineupNameId(database, id, "Bring Me the Horizon"), name: "Bring Me the Horizon" },
    ],
    removedNames: [{ lineupNameId: lineupNameId(database, id, "Gojira"), name: "Gojira" }],
  });
  assert.deepEqual(
    currentLineup(database, id).map((name) => name.name),
    ["Architects", "Bring Me the Horizon", "Ghost", "Turnstile"],
  );
});

test("a published festival stays published when new names appear", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push(lineupOf("Ghost", "Gojira", "Turnstile", "Architects"));

  await check();

  assert.equal(findFestivalForAdmin(database, id)!.published, true);
  assert.deepEqual(
    listPublishedFestivals(database, "2027-06-02").toCome.map((festival) => festival.id),
    [id],
  );
});

test("a check without changes keeps the last lineup change", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push(lineupOf("Ghost", "Turnstile"));
  await check();
  clock.advance(day);
  results.push(lineupOf("Ghost", "Turnstile"));

  await check();

  const change = lastLineupChange(database, id)!;
  assert.deepEqual(change.at, new Date("2027-06-02T09:00:00Z"));
  assert.deepEqual(change.removedNames.map((name) => name.name), ["Gojira"]);
  assert.deepEqual(findFestivalForAdmin(database, id)!.lineupUpdatedAt, new Date("2027-06-03T09:00:00Z"));
});

test("a name that comes back after a removal is a new name again", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push(lineupOf("Ghost", "Turnstile"));
  await check();
  clock.advance(day);
  results.push(lineupOf("Ghost", "Gojira", "Turnstile"));

  await check();

  const change = lastLineupChange(database, id)!;
  assert.deepEqual(change.newNames.map((name) => name.name), ["Gojira"]);
  assert.deepEqual(change.removedNames, []);
});

test("a source failure records the time and the cause, and does not change the stored lineup", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push({ outcome: "failed", cause: "Clashfinder did not give the page \"download\" (status 503)." });

  await check();

  const festival = findFestivalForAdmin(database, id)!;
  assert.deepEqual(festival.lineupProblem, {
    at: new Date("2027-06-02T09:00:00Z"),
    cause: "Clashfinder did not give the page \"download\" (status 503).",
  });
  assert.deepEqual(festival.lineupUpdatedAt, new Date("2027-06-01T09:00:00Z"));
  assert.deepEqual(
    currentLineup(database, id).map((name) => name.name),
    ["Ghost", "Gojira", "Turnstile"],
  );
  assert.equal(lastLineupChange(database, id), undefined);
  assert.equal(festival.published, true);
});

test("the check runs once a day for each festival, also after a failure", async (t) => {
  const { database, clock, results, id, check } = await setUp(t);
  clock.advance(day);
  results.push({ outcome: "failed", cause: "Network failure." });
  await check();

  // Later on the same day, the festival is not due.
  clock.advance(10 * hour);
  results.push(lineupOf("Ghost"));
  await check();
  assert.deepEqual(results, [lineupOf("Ghost")], "The second check of the day sent no request");

  // After midnight in the United Kingdom (23:00 UTC in British Summer Time), the festival is due again.
  clock.set(new Date("2027-06-02T23:00:00Z"));
  assert.deepEqual(dueFestivals(database, clock.now()), [id]);
  await check();
  assert.deepEqual(currentLineup(database, id).map((name) => name.name), ["Ghost"]);
});

test("a check by the admin counts as the check of the day", async (t) => {
  const { database, clock, id } = await setUp(t);

  // The lineup in setUp is from 09:00 today.
  assert.deepEqual(dueFestivals(database, clock.now()), []);
  clock.advance(day);
  assert.deepEqual(dueFestivals(database, clock.now()), [id]);
});

test("the check stops when the festival starts", async (t) => {
  const { database, clock, id } = await setUp(t);

  clock.set(new Date("2027-06-10T09:00:00Z"));
  assert.deepEqual(dueFestivals(database, clock.now()), [id], "The day before the festival");
  clock.set(new Date("2027-06-10T23:30:00Z"));
  assert.deepEqual(dueFestivals(database, clock.now()), [], "11 June in the United Kingdom");
  clock.set(new Date("2027-06-12T09:00:00Z"));
  assert.deepEqual(dueFestivals(database, clock.now()), []);
});

test("the check does not get the lineup of a festival that is not published", async (t) => {
  const { database, clock } = await setUp(t);
  const added = addFestival(
    database,
    { name: "Bloodstock", year: 2027, startDate: "2027-08-05", endDate: "2027-08-08", expectedGenres: ["metal"], page: "bloodstock" },
    { source: "clashfinder", page: "bloodstock", pageName: "Bloodstock" },
  );
  assert.equal(added.outcome, "added");
  clock.advance(day);

  assert.deepEqual(dueFestivals(database, clock.now()).includes(added.outcome === "added" ? added.id : 0), false);
});

test(`one run checks a maximum of ${maximumChecksInRun} festivals, the festival that starts first first`, async (t) => {
  const { database, clock, id, check } = await setUp(t);
  const others: number[] = [];
  for (let index = 1; index <= maximumChecksInRun; index++) {
    others.push(await addPublished(database, clock, `Festival ${index}`, `2027-07-0${index}`, ["Ghost"]));
  }
  clock.advance(day);
  const checked: number[] = [];
  const run = () =>
    checkDueLineups(database, clock, async (festivalId) => {
      checked.push(festivalId);
      return getFestivalLineup(database, { getLineup: async () => lineupOf("Ghost") }, clock, festivalId);
    });

  await run();
  assert.deepEqual(checked, [id, ...others.slice(0, maximumChecksInRun - 1)]);

  // The next run checks the festival that is still due.
  await run();
  assert.deepEqual(checked.slice(maximumChecksInRun), [others.at(-1)]);
});

test("after a change of the lineup source, the check gets the lineup from the new source", async (t) => {
  const { database, clock, id } = await setUp(t);
  changeLineupSource(database, id, { source: "clashfinder", page: "dl27-official", pageName: "Download Festival 2027" });
  clock.advance(day);
  const pages: string[] = [];

  await checkDueLineups(database, clock, (festivalId) =>
    getFestivalLineup(database, { getLineup: async (settings) => (pages.push(settings.page), lineupOf("Ghost", "Gojira")) }, clock, festivalId),
  );

  assert.deepEqual(pages, ["dl27-official"]);
  assert.deepEqual(findFestivalForAdmin(database, id)!.lineupSource, {
    source: "clashfinder",
    page: "dl27-official",
    pageName: "Download Festival 2027",
  });
  assert.deepEqual(lastLineupChange(database, id)!.removedNames.map((name) => name.name), ["Turnstile"]);
});

function lineupNameId(database: Database, festivalId: number, name: string): number {
  const row = database.prepare("SELECT id FROM lineup_name WHERE festival_id = ? AND name = ?").get(festivalId, name) as { id: number };
  return row.id;
}
