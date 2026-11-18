import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { withServiceRules } from "../../src/http-client.ts";
import { createMusicBrainz, musicbrainzLinksUrl, type MusicBrainzArtist } from "../../src/musicbrainz.ts";
import { createSessions } from "../../src/sessions.ts";
import {
  createSpotifyArtistQueue,
  findSpotifyArtist,
  findSpotifyArtistFor,
  setSpotifyArtistByHand,
} from "../../src/spotify-artists.ts";
import { createSpotify, spotifyArtistUrl } from "../../src/spotify.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { busyResponse, linksResponse, musicbrainzIds, respondWithRecordedMusicBrainz } from "../support/musicbrainz.ts";
import { quotaExceededResponse, respondWithRecordedSpotify, spotifyIds } from "../support/spotify.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { adminSpotifyUserId, testSettings } from "../support/test-settings.ts";

function setUp(t: TestContext) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock();
  const settings = testSettings();
  createSessions(database, clock, settings).logIn({ spotifyUserId: adminSpotifyUserId, displayName: "Kit Admin", refreshToken: "refresh-token-0" });
  const transport = new FakeHttpClient();
  const respondTo = transport.respondTo.bind(transport);
  respondWithRecordedMusicBrainz(respondTo);
  respondWithRecordedSpotify(respondTo);
  const httpClient = withServiceRules(transport, settings, clock);
  const musicBrainz = createMusicBrainz(httpClient);
  const spotify = createSpotify(httpClient, database, clock, settings);
  const queue = createSpotifyArtistQueue(database, musicBrainz, spotify, clock);
  return { database, clock, transport, musicBrainz, spotify, queue };
}

// The MusicBrainz artist as a search gives it. Only the ID, the name and the aliases are necessary.
function artist(id: string, name: string, aliases: string[] = []): MusicBrainzArtist {
  return { id, name, aliases, ended: false, genres: [], score: 100, votes: 0 };
}

const bringMeTheHorizon = artist(musicbrainzIds.bringMeTheHorizon, "Bring Me the Horizon", ["BMTH"]);
const ghostJapan = artist(musicbrainzIds.ghostJapan, "Ghost");
const tribute = artist(musicbrainzIds.bringMeTheHorizonUk, "Bring Me the Horizon UK");

test("MusicBrainz gives the Spotify artist IDs of the current Spotify links", async (t) => {
  const { musicBrainz } = setUp(t);

  assert.deepEqual(await musicBrainz.spotifyLinks(musicbrainzIds.bringMeTheHorizon), { outcome: "found", spotifyIds: [spotifyIds.bringMeTheHorizon] });
  // Pierce the Veil also has a link to a Spotify user. It is not an artist.
  assert.deepEqual(await musicBrainz.spotifyLinks(musicbrainzIds.pierceTheVeil), { outcome: "found", spotifyIds: [spotifyIds.pierceTheVeil] });
  assert.deepEqual(await musicBrainz.spotifyLinks(musicbrainzIds.ghostJapan), { outcome: "found", spotifyIds: [] });
});

test("an artist with a MusicBrainz Spotify link gets that Spotify artist", async (t) => {
  const { transport, musicBrainz, spotify } = setUp(t);

  const result = await findSpotifyArtistFor(musicBrainz, spotify, bringMeTheHorizon);

  assert.deepEqual(result, {
    outcome: "found",
    artist: { id: spotifyIds.bringMeTheHorizon, name: "Bring Me The Horizon" },
    source: "musicbrainz",
  });
  assert.ok(!transport.requests.some(({ url }) => url.includes("/v1/search")), "No search when there is a link");
});

test("an artist without a Spotify link gets the first search result with the same name", async (t) => {
  const { musicBrainz, spotify } = setUp(t);

  // The search for the Japanese band "Ghost" gives the Swedish band first. The
  // admin must correct this by hand (user story 64).
  const result = await findSpotifyArtistFor(musicBrainz, spotify, ghostJapan);

  assert.deepEqual(result, { outcome: "found", artist: { id: spotifyIds.ghostSweden, name: "Ghost" }, source: "search" });
});

test("an artist without a Spotify link and without a search result with the same name gets “not found”", async (t) => {
  const { musicBrainz, spotify } = setUp(t);

  // The search gives "Bring Me The Horizon", which is not the tribute band.
  assert.deepEqual(await findSpotifyArtistFor(musicBrainz, spotify, tribute), { outcome: "not-found" });
});

test("a link to an artist that Spotify does not have gives a search", async (t) => {
  const { transport, musicBrainz, spotify } = setUp(t);
  transport.respondTo("GET", spotifyArtistUrl(spotifyIds.ghostSweden), {
    status: 404,
    body: '{"error":{"status":404,"message":"Resource not found"}}',
  });

  const result = await findSpotifyArtistFor(musicBrainz, spotify, artist(musicbrainzIds.ghostSweden, "Ghost"));

  assert.deepEqual(result, { outcome: "found", artist: { id: spotifyIds.ghostSweden, name: "Ghost" }, source: "search" });
});

test("the queue finds and stores the Spotify artist of each artist once", async (t) => {
  const { database, transport, queue } = setUp(t);

  queue.find([bringMeTheHorizon, ghostJapan, tribute]);
  queue.find([bringMeTheHorizon]);
  await queue.idle();

  assert.deepEqual(findSpotifyArtist(database, bringMeTheHorizon.id), {
    kind: "found",
    artist: { id: spotifyIds.bringMeTheHorizon, name: "Bring Me The Horizon" },
    source: "musicbrainz",
    foundAt: new Date("2027-01-15T12:00:00Z"),
  });
  assert.equal(findSpotifyArtist(database, ghostJapan.id)?.kind, "found");
  assert.equal(findSpotifyArtist(database, tribute.id)?.kind, "not-found");
  assert.equal(transport.requests.filter(({ url }) => url === musicbrainzLinksUrl(bringMeTheHorizon.id)).length, 1);

  queue.find([bringMeTheHorizon]);
  await queue.idle();
  assert.equal(transport.requests.filter(({ url }) => url === musicbrainzLinksUrl(bringMeTheHorizon.id)).length, 1, "A stored artist is not found again");
});

test("a later change of the MusicBrainz data replaces a found Spotify artist", async (t) => {
  const { database, transport, queue } = setUp(t);
  queue.find([ghostJapan]);
  await queue.idle();
  const first = findSpotifyArtist(database, ghostJapan.id);
  assert.equal(first?.kind === "found" && first.source, "search");

  // MusicBrainz now has a link from the Japanese band to the Spotify artist of The Prodigy.
  transport.respondTo("GET", musicbrainzLinksUrl(ghostJapan.id), linksResponse(musicbrainzIds.theProdigy));
  queue.find([ghostJapan], { again: true });
  await queue.idle();

  const stored = findSpotifyArtist(database, ghostJapan.id);
  assert.equal(stored?.kind === "found" && stored.artist.id, spotifyIds.theProdigy);
  assert.equal(stored?.kind === "found" && stored.source, "musicbrainz");
});

test("a later change of the MusicBrainz data does not replace a Spotify artist that the admin set by hand", async (t) => {
  const { database, clock, transport, queue } = setUp(t);
  queue.find([ghostJapan]);
  await queue.idle();
  clock.advance(60_000);
  setSpotifyArtistByHand(database, clock, ghostJapan.id, { id: "3SjDDFjFJnOeiLJcq1QUqT", name: "Ghost" });

  transport.respondTo("GET", musicbrainzLinksUrl(ghostJapan.id), linksResponse(musicbrainzIds.theProdigy));
  queue.find([ghostJapan], { again: true });
  await queue.idle();

  assert.deepEqual(findSpotifyArtist(database, ghostJapan.id), {
    kind: "found",
    artist: { id: "3SjDDFjFJnOeiLJcq1QUqT", name: "Ghost" },
    source: "admin",
    foundAt: clock.now(),
  });
  assert.ok(!transport.requests.some(({ url }) => url === spotifyArtistUrl(spotifyIds.theProdigy)), "No request for an artist set by hand");
});

test("a failure stops the queue and records the cause, and a new run continues", async (t) => {
  const { database, transport, queue } = setUp(t);
  transport.respondTo("GET", musicbrainzLinksUrl(ghostJapan.id), busyResponse);

  queue.find([bringMeTheHorizon, ghostJapan, tribute]);
  await queue.idle();

  assert.match(queue.state().problem?.cause ?? "", /MusicBrainz was busy/);
  assert.equal(findSpotifyArtist(database, bringMeTheHorizon.id)?.kind, "found");
  assert.equal(findSpotifyArtist(database, tribute.id), undefined, "The queue stops at the failure");

  respondWithRecordedMusicBrainz(transport.respondTo.bind(transport));
  queue.find([ghostJapan, tribute]);
  await queue.idle();
  assert.deepEqual(queue.state(), { running: false });
  assert.equal(findSpotifyArtist(database, tribute.id)?.kind, "not-found");
});

test("a Spotify quota error stops the queue with its cause", async (t) => {
  const { transport, queue } = setUp(t);
  transport.respondTo("GET", spotifyArtistUrl(spotifyIds.bringMeTheHorizon), quotaExceededResponse);

  queue.find([bringMeTheHorizon]);
  await queue.idle();

  assert.match(queue.state().problem?.cause ?? "", /used all of its Spotify quota \(status 429, QUOTA_EXCEEDED\)/);
});
