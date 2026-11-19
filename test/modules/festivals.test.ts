import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { saveArtistMatch } from "../../src/artist-matches.ts";
import { openDatabase } from "../../src/database.ts";
import { addFestival, findFestivalForAdmin, findPublishedFestival, listPublishedFestivals, londonDate, publishFestival } from "../../src/festivals.ts";
import { getFestivalLineup } from "../../src/lineups.ts";
import type { MusicBrainzArtist } from "../../src/musicbrainz.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

const bringMeTheHorizon = { id: "074e3847-f67f-49f9-81f1-8c8cea147e8e", name: "Bring Me the Horizon" } as MusicBrainzArtist;

function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock();

  // Adds a festival with a lineup of the names. No names: the festival has no lineup.
  async function addFestivalWith(name: string, names: string[]): Promise<number> {
    const added = addFestival(
      database,
      { name, year: 2027, startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: [], page: "download27" },
      { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" },
    );
    assert.equal(added.outcome, "added");
    const id = added.outcome === "added" ? added.id : 0;
    if (names.length > 0) {
      const source = { getLineup: async () => ({ outcome: "got" as const, lineup: { entries: names.map((each) => ({ name: each })) } }) };
      await getFestivalLineup(database, source, clock, id);
    }
    return id;
  }

  return { database, clock, addFestivalWith };
}

test("listPublishedFestivals is empty when no festival is published", (t) => {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  database
    .prepare("INSERT INTO festival (name, year, start_date, end_date, published) VALUES (?, ?, ?, ?, 0)")
    .run("Bloodstock", 2027, "2027-08-05", "2027-08-08");

  assert.deepEqual(listPublishedFestivals(database, "2027-01-15"), { toCome: [], complete: [] });
});

test("listPublishedFestivals gives the festivals to come first, the next first, then the complete festivals, the most recent first", (t) => {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const insert = database.prepare(
    "INSERT INTO festival (name, year, start_date, end_date, published) VALUES (?, ?, ?, ?, ?)",
  );
  insert.run("Download", 2027, "2027-06-11", "2027-06-13", 1);
  insert.run("Bloodstock", 2027, "2027-08-05", "2027-08-08", 1);
  insert.run("Slam Dunk", 2027, "2027-05-22", "2027-05-23", 1);
  insert.run("Download", 2026, "2026-06-12", "2026-06-14", 1);
  insert.run("Hidden", 2027, "2027-07-01", "2027-07-02", 0);

  const names = (today: string) => {
    const { toCome, complete } = listPublishedFestivals(database, today);
    return {
      toCome: toCome.map((festival) => `${festival.name} ${festival.year}`),
      complete: complete.map((festival) => `${festival.name} ${festival.year}`),
    };
  };

  assert.deepEqual(names("2027-01-15"), {
    toCome: ["Slam Dunk 2027", "Download 2027", "Bloodstock 2027"],
    complete: ["Download 2026"],
  });
  // A festival is still to come on its last day.
  assert.deepEqual(names("2027-06-13"), {
    toCome: ["Download 2027", "Bloodstock 2027"],
    complete: ["Slam Dunk 2027", "Download 2026"],
  });
  assert.deepEqual(names("2027-06-14"), {
    toCome: ["Bloodstock 2027"],
    complete: ["Download 2027", "Slam Dunk 2027", "Download 2026"],
  });
});

test("londonDate gives the date in the United Kingdom", () => {
  // 23:30 UTC on 13 June is 00:30 on 14 June in British Summer Time.
  assert.equal(londonDate(new Date("2027-06-13T23:30:00Z")), "2027-06-14");
  assert.equal(londonDate(new Date("2027-01-15T23:30:00Z")), "2027-01-15");
});

test("the admin cannot publish a festival with a lineup name that has no artist match and no “no match” mark", async (t) => {
  const { database, clock, addFestivalWith } = setUp(t);
  const id = await addFestivalWith("Download", ["Bring Me The Horizon", "???", "Turnstile"]);
  saveArtistMatch(database, clock, "Bring Me The Horizon", { kind: "artist", artist: bringMeTheHorizon });

  assert.deepEqual(publishFestival(database, id), { outcome: "unmatched", unmatched: 2 });
  assert.equal(findFestivalForAdmin(database, id)?.published, false);
  assert.equal(findPublishedFestival(database, id), undefined);
});

test("the admin can publish a festival when each lineup name has an artist match or a “no match” mark", async (t) => {
  const { database, clock, addFestivalWith } = setUp(t);
  const id = await addFestivalWith("Download", ["Bring Me The Horizon", "???"]);
  saveArtistMatch(database, clock, "Bring Me The Horizon", { kind: "artist", artist: bringMeTheHorizon });
  saveArtistMatch(database, clock, "???", { kind: "no-match" });

  assert.deepEqual(publishFestival(database, id), { outcome: "published" });
  assert.equal(findFestivalForAdmin(database, id)?.published, true);
  assert.equal(findPublishedFestival(database, id)?.name, "Download");
});

test("the admin cannot publish a festival without a lineup", async (t) => {
  const { database, addFestivalWith } = setUp(t);
  const id = await addFestivalWith("Download", []);

  assert.deepEqual(publishFestival(database, id), { outcome: "no-lineup" });
  assert.equal(findFestivalForAdmin(database, id)?.published, false);
});
