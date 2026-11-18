import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import {
  checkGenres,
  createArtistSearchQueue,
  festivalArtistMatches,
  findArtistMatch,
  proposeArtist,
  saveArtistMatch,
} from "../../src/artist-matches.ts";
import { openDatabase } from "../../src/database.ts";
import { addFestival } from "../../src/festivals.ts";
import { withServiceRules } from "../../src/http-client.ts";
import { getFestivalLineup } from "../../src/lineups.ts";
import { createMusicBrainz, musicbrainzSearchUrl, type MusicBrainzArtist } from "../../src/musicbrainz.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { busyResponse, download2027Names, respondWithRecordedMusicBrainz } from "../support/musicbrainz.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { testSettings } from "../support/test-settings.ts";

const metal = ["metal", "hard rock"];

const ids = {
  bringMeTheHorizon: "074e3847-f67f-49f9-81f1-8c8cea147e8e",
  turnstileUs: "7b748dac-f5ce-45a7-9b95-c1d8b5b013ed",
  ghostSweden: "2bcf2e02-5bc3-4c76-bf76-41126cb11444",
  ghostJapan: "97ea6a8e-2011-45f0-895e-8bb082b1aa64",
  theProdigy: "4a4ee089-93b1-4470-af9a-6ff575d32704",
};

function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock(new Date("2026-11-18T17:10:00Z"));
  const transport = new FakeHttpClient();
  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));
  const musicBrainz = createMusicBrainz(withServiceRules(transport, testSettings(), clock));
  const queue = createArtistSearchQueue(database, musicBrainz, clock);

  // Adds a festival with a lineup of the names.
  async function addFestivalWith(name: string, names: string[]): Promise<number> {
    const added = addFestival(
      database,
      { name, year: 2027, startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: metal, page: "download27" },
      { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" },
    );
    assert.equal(added.outcome, "added");
    const id = added.outcome === "added" ? added.id : 0;
    const source = { getLineup: async () => ({ outcome: "got" as const, lineup: { entries: names.map((each) => ({ name: each })) } }) };
    await getFestivalLineup(database, source, clock, id);
    return id;
  }

  return { database, clock, transport, musicBrainz, queue, addFestivalWith };
}

async function searchFor(musicBrainz: ReturnType<typeof createMusicBrainz>, text: string): Promise<MusicBrainzArtist[]> {
  const result = await musicBrainz.searchArtists(text);
  assert.equal(result.outcome, "found");
  return result.outcome === "found" ? result.artists : [];
}

test("the proposal is the artist with the same name, before tribute bands and members", async (t) => {
  const { musicBrainz } = setUp(t);

  const artists = await searchFor(musicBrainz, "Bring Me The Horizon");

  assert.deepEqual(proposeArtist("Bring Me The Horizon", artists, metal), { kind: "artist", id: ids.bringMeTheHorizon });
});

test("the proposal compares names without case, accents and hyphens", async (t) => {
  const { musicBrainz } = setUp(t);

  // MusicBrainz gives "blink‐182" with a Unicode hyphen.
  const blink = await searchFor(musicBrainz, "Blink 182");
  const motley = await searchFor(musicBrainz, "Mötley Crüe");

  assert.equal(proposeArtist("Blink 182", blink, metal)?.kind, "artist");
  assert.equal(proposeArtist("Blink 182", blink, metal)?.kind === "artist" && blink[0]!.name, "blink‐182");
  assert.deepEqual(proposeArtist("Motley Crue", motley, metal), { kind: "artist", id: motley[0]!.id });
});

test("of artists with the same name, the proposal prefers an expected genre, then more votes", async (t) => {
  const { musicBrainz } = setUp(t);
  const ghost = await searchFor(musicBrainz, "Ghost");
  const turnstile = await searchFor(musicBrainz, "Turnstile");

  assert.deepEqual(proposeArtist("Ghost", ghost, metal), { kind: "artist", id: ids.ghostSweden });
  // Only the Japanese band has "experimental rock". The Swedish band has more votes.
  assert.deepEqual(proposeArtist("Ghost", ghost, ["experimental rock"]), { kind: "artist", id: ids.ghostJapan });
  // No Turnstile has an expected genre. The US band has the most votes.
  assert.deepEqual(proposeArtist("Turnstile", turnstile, metal), { kind: "artist", id: ids.turnstileUs });
});

test("the proposal is “no match” for a placeholder name, for more than one artist and for an empty search", async (t) => {
  const { musicBrainz } = setUp(t);
  // MusicBrainz has artists with the name "???".
  const questionMarks = await searchFor(musicBrainz, "???");

  assert.deepEqual(proposeArtist("???", questionMarks, metal), { kind: "no-match" });
  assert.deepEqual(proposeArtist("Special guest TBA", questionMarks, metal), { kind: "no-match" });
  assert.deepEqual(proposeArtist("Andy C b2b Hype", questionMarks, metal), { kind: "no-match" });
  assert.deepEqual(proposeArtist("Somebody", [], metal), { kind: "no-match" });
});

test("there is no proposal when no artist has the same name", async (t) => {
  const { musicBrainz } = setUp(t);
  const artists = await searchFor(musicBrainz, "Bring Me The Horizon");

  assert.equal(proposeArtist("Bring Me The Horizon Acoustic", artists, metal), undefined);
});

test("the genre check gives a warning for an artist with none of the expected genres", async (t) => {
  const { musicBrainz } = setUp(t);
  const [prodigy] = await searchFor(musicBrainz, "The Prodigy");
  const [evanescence] = await searchFor(musicBrainz, "Evanescence");
  const [, tribute] = await searchFor(musicBrainz, "Bring Me The Horizon");

  // "heavy metal" and "gothic metal" contain the expected genre "metal".
  // "alternative metal" and "gothic metal" contain the expected genre "metal".
  // "hard rock" has 0 votes for Evanescence, so it is not a genre of the artist.
  assert.deepEqual(checkGenres(evanescence!, metal), {
    outcome: "agrees",
    genres: ["alternative metal", "metal", "symphonic metal", "gothic metal", "heavy metal"],
  });
  // The Prodigy has "rock", which is not "hard rock".
  assert.deepEqual(checkGenres(prodigy!, metal), { outcome: "no-expected-genre" });
  assert.deepEqual(checkGenres(tribute!, metal), { outcome: "no-genres" });
  // "metalcore" is a different genre from "metal".
  assert.deepEqual(checkGenres({ ...prodigy!, genres: ["metalcore"] }, ["metal"]), { outcome: "no-expected-genre" });
  assert.deepEqual(checkGenres({ ...prodigy!, genres: ["hip-hop"] }, ["Hip Hop"]), { outcome: "agrees", genres: ["hip-hop"] });
});

test("a match with a genre warning is saved", async (t) => {
  const { database, clock, musicBrainz } = setUp(t);
  const [prodigy] = await searchFor(musicBrainz, "The Prodigy");

  saveArtistMatch(database, clock, "The Prodigy", { kind: "artist", artist: prodigy! });

  const match = findArtistMatch(database, "The Prodigy");
  assert.equal(match?.kind, "artist");
  assert.equal(match?.kind === "artist" && match.artist.id, ids.theProdigy);
});

test("an artist match from one festival applies to the same name on a second festival", async (t) => {
  const { database, clock, musicBrainz, addFestivalWith } = setUp(t);
  const [band] = await searchFor(musicBrainz, "Bring Me The Horizon");
  const download = await addFestivalWith("Download", ["Bring Me The Horizon", "???"]);
  saveArtistMatch(database, clock, "Bring Me The Horizon", { kind: "artist", artist: band! });
  saveArtistMatch(database, clock, "???", { kind: "no-match" });

  // The second lineup source writes the name with a different case.
  const slamDunk = await addFestivalWith("Slam Dunk", ["Bring Me the Horizon", "Turnstile"]);

  const names = festivalArtistMatches(database, slamDunk);
  assert.deepEqual(
    names.map(({ name, match }) => [name, match?.kind === "artist" ? match.artist.id : match?.kind]),
    [
      ["Bring Me the Horizon", ids.bringMeTheHorizon],
      ["Turnstile", undefined],
    ],
  );
  assert.equal(festivalArtistMatches(database, download).find(({ name }) => name === "???")?.match?.kind, "no-match");
});

test("the admin can change a match, and the change applies on each festival", async (t) => {
  const { database, clock, musicBrainz, addFestivalWith } = setUp(t);
  const [band] = await searchFor(musicBrainz, "Bring Me The Horizon");
  const first = await addFestivalWith("Download", ["Bring Me The Horizon"]);
  const second = await addFestivalWith("Slam Dunk", ["Bring Me The Horizon"]);
  saveArtistMatch(database, clock, "Bring Me The Horizon", { kind: "no-match" });

  clock.advance(60_000);
  saveArtistMatch(database, clock, "Bring Me The Horizon", { kind: "artist", artist: band! });

  for (const festival of [first, second]) {
    const [name] = festivalArtistMatches(database, festival);
    assert.equal(name!.match?.kind, "artist");
    assert.deepEqual(name!.match?.matchedAt, clock.now());
  }
});

test("the search queue searches each name without a match once, and stores the result", async (t) => {
  const { database, clock, transport, queue, addFestivalWith } = setUp(t);
  const id = await addFestivalWith("Download", download2027Names);
  saveArtistMatch(database, clock, "Turnstile", { kind: "no-match" });

  queue.searchFestival(id);
  queue.searchFestival(id);
  await queue.idle();

  const names = festivalArtistMatches(database, id);
  assert.deepEqual(
    names.filter((name) => name.search === undefined).map(({ name }) => name),
    ["Turnstile"],
    "Each name without a match has a stored search",
  );
  const searches = transport.requests.filter(({ url }) => url.includes("/ws/2/artist"));
  assert.equal(searches.length, 9, "One search for each of the 9 names without a match");
  assert.equal(new Set(searches.map(({ url }) => url)).size, 9);
  assert.ok(!searches.some(({ url }) => url === musicbrainzSearchUrl("Turnstile")));
  assert.deepEqual(queue.state(), { running: false });
});

test("a failed search stops the queue and records the cause, and a new run continues", async (t) => {
  const { database, transport, queue, addFestivalWith } = setUp(t);
  const id = await addFestivalWith("Download", ["Evanescence", "Ghost", "Turnstile"]);
  transport.respondTo("GET", musicbrainzSearchUrl("Ghost"), busyResponse);

  queue.searchFestival(id);
  await queue.idle();

  const state = queue.state();
  assert.equal(state.running, false);
  assert.match(state.problem?.cause ?? "", /MusicBrainz was busy/);
  const searched = () => festivalArtistMatches(database, id).filter((name) => name.search !== undefined).map(({ name }) => name);
  assert.deepEqual(searched(), ["Evanescence"], "The queue stops at the failure");

  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));
  queue.searchFestival(id);
  await queue.idle();

  assert.deepEqual(searched(), ["Evanescence", "Ghost", "Turnstile"]);
  assert.deepEqual(queue.state(), { running: false });
});
