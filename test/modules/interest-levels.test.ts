import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { saveArtistMatch } from "../../src/artist-matches.ts";
import { openDatabase } from "../../src/database.ts";
import { addFestival } from "../../src/festivals.ts";
import { festivalLineup, saveInterestLevels } from "../../src/interest-levels.ts";
import { getFestivalLineup } from "../../src/lineups.ts";
import type { MusicBrainzArtist } from "../../src/musicbrainz.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";

function artist(name: string, genres: string[]): MusicBrainzArtist {
  return { id: `id-${name}`, name, genres, ended: false, score: 100, votes: 1, aliases: [] };
}

function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock();
  const addUser = (spotifyUserId: string) =>
    (
      database
        .prepare("INSERT INTO user (spotify_user_id, display_name, refresh_token) VALUES (?, ?, 'token') RETURNING id")
        .get(spotifyUserId, spotifyUserId) as { id: number }
    ).id;

  // Adds a festival with a lineup of the names. Each name gets a match to an
  // artist, except "???", which is marked "no match".
  async function addFestivalWith(name: string, names: string[]): Promise<number> {
    const added = addFestival(
      database,
      { name, year: 2027, startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: [], page: "download27" },
      { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" },
    );
    assert.equal(added.outcome, "added");
    const id = added.outcome === "added" ? added.id : 0;
    await setLineup(id, names);
    for (const each of names) {
      saveArtistMatch(database, clock, each, each === "???" ? { kind: "no-match" } : { kind: "artist", artist: artist(each, ["metal"]) });
    }
    return id;
  }

  async function setLineup(festivalId: number, names: string[]): Promise<void> {
    clock.advance(60_000);
    const source = { getLineup: async () => ({ outcome: "got" as const, lineup: { entries: names.map((each) => ({ name: each })) } }) };
    await getFestivalLineup(database, source, clock, festivalId);
  }

  const idOf = (festivalId: number, userId: number, name: string) =>
    festivalLineup(database, festivalId, userId).find((each) => each.name === name)!.lineupNameId;

  return { database, addUser, addFestivalWith, setLineup, idOf };
}

test("festivalLineup gives each artist on the lineup with its genres at Curious, without names marked “no match”", async (t) => {
  const { database, addUser, addFestivalWith } = setUp(t);
  const user = addUser("alex");
  const festival = await addFestivalWith("Download", ["Ghost", "???", "Bring Me The Horizon"]);

  const lineup = festivalLineup(database, festival, user);

  assert.deepEqual(
    lineup.map(({ name, genres, level }) => ({ name, genres, level })),
    [
      { name: "Bring Me The Horizon", genres: ["metal"], level: "curious" },
      { name: "Ghost", genres: ["metal"], level: "curious" },
    ],
  );
});

test("festivalLineup does not include a lineup name without an artist match", async (t) => {
  const { database, addUser, addFestivalWith, setLineup } = setUp(t);
  const user = addUser("alex");
  const festival = await addFestivalWith("Download", ["Ghost"]);
  await setLineup(festival, ["Ghost", "Unmatched Name"]);

  assert.deepEqual(
    festivalLineup(database, festival, user).map((each) => each.name),
    ["Ghost"],
  );
});

test("saveInterestLevels saves the level of each user separately, and a new save replaces the level", async (t) => {
  const { database, addUser, addFestivalWith, idOf } = setUp(t);
  const alex = addUser("alex");
  const sam = addUser("sam");
  const festival = await addFestivalWith("Download", ["Ghost", "Bring Me The Horizon", "Turnstile"]);
  const ghost = idOf(festival, alex, "Ghost");
  const turnstile = idOf(festival, alex, "Turnstile");

  assert.deepEqual(saveInterestLevels(database, festival, alex, new Map([[ghost, "keen"], [turnstile, "not-interested"]])), {
    outcome: "saved",
  });
  saveInterestLevels(database, festival, alex, new Map([[ghost, "must-see"]]));
  saveInterestLevels(database, festival, sam, new Map([[turnstile, "keen"]]));

  const levels = (user: number) => festivalLineup(database, festival, user).map(({ name, level }) => [name, level]);
  assert.deepEqual(levels(alex), [
    ["Bring Me The Horizon", "curious"],
    ["Ghost", "must-see"],
    ["Turnstile", "not-interested"],
  ]);
  assert.deepEqual(levels(sam), [
    ["Bring Me The Horizon", "curious"],
    ["Ghost", "curious"],
    ["Turnstile", "keen"],
  ]);
});

test("saveInterestLevels saves nothing when a lineup name is not an artist on the lineup of the festival", async (t) => {
  const { database, addUser, addFestivalWith, idOf } = setUp(t);
  const user = addUser("alex");
  const download = await addFestivalWith("Download", ["Ghost", "???"]);
  const slamDunk = await addFestivalWith("Slam Dunk", ["Turnstile"]);
  const ghost = idOf(download, user, "Ghost");
  const turnstile = idOf(slamDunk, user, "Turnstile");
  const noMatch = (database.prepare("SELECT id FROM lineup_name WHERE name = '???'").get() as { id: number }).id;

  assert.deepEqual(saveInterestLevels(database, download, user, new Map([[ghost, "keen"], [turnstile, "keen"]])), {
    outcome: "not-on-lineup",
    lineupNameId: turnstile,
  });
  assert.deepEqual(saveInterestLevels(database, download, user, new Map([[noMatch, "keen"]])), {
    outcome: "not-on-lineup",
    lineupNameId: noMatch,
  });
  assert.equal(festivalLineup(database, download, user)[0]!.level, "curious");
});

test("an artist keeps its interest level when the lineup changes and the name stays on it", async (t) => {
  const { database, addUser, addFestivalWith, setLineup, idOf } = setUp(t);
  const user = addUser("alex");
  const festival = await addFestivalWith("Download", ["Ghost", "Turnstile"]);
  saveInterestLevels(database, festival, user, new Map([[idOf(festival, user, "Ghost"), "must-see"]]));

  await setLineup(festival, ["Ghost"]);

  assert.deepEqual(
    festivalLineup(database, festival, user).map(({ name, level }) => [name, level]),
    [["Ghost", "must-see"]],
  );
});
