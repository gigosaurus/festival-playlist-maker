import assert from "node:assert/strict";
import { test } from "node:test";
import { musicbrainzRequestDelay, withServiceRules } from "../../src/http-client.ts";
import { createMusicBrainz, musicbrainzSearchUrl } from "../../src/musicbrainz.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { busyResponse, genreListUrl, respondWithRecordedMusicBrainz } from "../support/musicbrainz.ts";
import { testSettings } from "../support/test-settings.ts";

function setUp() {
  const transport = new FakeHttpClient();
  const clock = new FakeClock();
  const musicBrainz = createMusicBrainz(withServiceRules(transport, testSettings(), clock));
  return { transport, clock, musicBrainz };
}

test("a search gives each possible artist with its genres, country and active years", async () => {
  const { transport, musicBrainz } = setUp();
  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));

  const result = await musicBrainz.searchArtists("Bring Me The Horizon");

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.equal(result.artists.length, 5);
  const [band] = result.artists;
  assert.equal(band!.id, "074e3847-f67f-49f9-81f1-8c8cea147e8e");
  assert.equal(band!.name, "Bring Me the Horizon");
  assert.equal(band!.type, "Group");
  assert.equal(band!.country, "GB");
  assert.equal(band!.begin, "2004-03");
  assert.equal(band!.ended, false);
  // Genres only, the most votes first. "metalcore" has 19 votes.
  assert.deepEqual(band!.genres.slice(0, 2), ["metalcore", "alternative rock"]);
  assert.ok(band!.aliases.includes("BMTH"));
});

test("the genres contain only MusicBrainz genres with positive votes", async () => {
  const { transport, musicBrainz } = setUp();
  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));

  const result = await musicBrainz.searchArtists("Blink 182");

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  const genres = result.artists[0]!.genres;
  // The recorded tags include "american" (not a genre), "usa" (-1 votes) and "rock" (0 votes).
  assert.ok(genres.includes("punk rock"));
  assert.ok(!genres.includes("american"));
  assert.ok(!genres.includes("usa"));
  assert.ok(!genres.includes("rock"));
});

test("the module gets the genre list once", async () => {
  const { transport, musicBrainz } = setUp();
  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));

  await musicBrainz.searchArtists("Ghost");
  await musicBrainz.searchArtists("Turnstile");

  assert.deepEqual(
    transport.requests.map(({ url }) => url),
    [genreListUrl, musicbrainzSearchUrl("Ghost"), musicbrainzSearchUrl("Turnstile")],
  );
});

test("the search text is escaped, and a MusicBrainz address searches for its artist ID", () => {
  assert.equal(new URL(musicbrainzSearchUrl("???")).searchParams.get("query"), "\\?\\?\\?");
  // Lowercase, so that a name that contains AND, OR or NOT is not a query operator.
  assert.equal(new URL(musicbrainzSearchUrl("Hot Water Music AND Friends")).searchParams.get("query"), "hot water music and friends");
  assert.equal(
    new URL(musicbrainzSearchUrl("https://musicbrainz.org/artist/074E3847-f67f-49f9-81f1-8c8cea147e8e")).searchParams.get("query"),
    "arid:074e3847-f67f-49f9-81f1-8c8cea147e8e",
  );
});

test("the module sends a request again after status 503, a maximum of 2 times", async () => {
  const { transport, musicBrainz } = setUp();
  respondWithRecordedMusicBrainz((method, url, response) => transport.respondTo(method, url, response));
  transport.respondTo("GET", musicbrainzSearchUrl("Ghost"), busyResponse);

  const result = await musicBrainz.searchArtists("Ghost");

  assert.deepEqual(result, {
    outcome: "failed",
    cause: "MusicBrainz was busy and refused the request 3 times (status 503). Try again in some minutes.",
  });
  assert.equal(transport.requests.filter(({ url }) => url === musicbrainzSearchUrl("Ghost")).length, 3);
});

test("a network failure gives the cause", async () => {
  const { transport, musicBrainz } = setUp();
  transport.send = async () => {
    throw new Error("getaddrinfo ENOTFOUND musicbrainz.org");
  };

  const result = await musicBrainz.searchArtists("Ghost");

  assert.deepEqual(result, {
    outcome: "failed",
    cause: "The application could not connect to MusicBrainz: getaddrinfo ENOTFOUND musicbrainz.org",
  });
});

test("the HTTP client sends the MusicBrainz User-Agent and waits 1 second between MusicBrainz requests", async () => {
  const clock = new FakeClock();
  const sent: { userAgent: string | null; at: number }[] = [];
  const client = withServiceRules(
    {
      async send(request) {
        sent.push({ userAgent: request.headers.get("user-agent"), at: clock.now().getTime() });
        return new Response("{}");
      },
    },
    testSettings(),
    clock,
  );

  await Promise.all([
    client.send(new Request(musicbrainzSearchUrl("Ghost"))),
    client.send(new Request(musicbrainzSearchUrl("Turnstile"))),
    client.send(new Request(musicbrainzSearchUrl("Evanescence"))),
  ]);
  await client.send(new Request("https://api.spotify.com/v1/me"));

  assert.equal(musicbrainzRequestDelay, 1_000);
  assert.deepEqual(clock.sleeps, [1_000, 1_000], "The second and the third request wait");
  assert.deepEqual(
    sent.slice(0, 3).map(({ at }) => at - sent[0]!.at),
    [0, 1_000, 2_000],
  );
  assert.match(sent[0]!.userAgent!, /^FestivalPlaylistMaker\/\d+\.\d+\.\d+ \( admin@festival-playlist-maker\.test \)$/);
  assert.notEqual(sent[3]!.userAgent, sent[0]!.userAgent, "Other services do not get the MusicBrainz User-Agent");
});
