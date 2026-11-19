import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { setlistFmLimitWait, withServiceRules } from "../../src/http-client.ts";
import { createMusicBrainz } from "../../src/musicbrainz.ts";
import {
  createPredictedSongQueue,
  createSongPrediction,
  findPredictedSongs,
  findTrack,
  scoreSongs,
} from "../../src/predicted-songs.ts";
import { createSessions } from "../../src/sessions.ts";
import { createSetlistFm, type Show } from "../../src/setlist-fm.ts";
import { defaultPredictionSettings, type PredictionSettings } from "../../src/settings.ts";
import { createSpotifyArtistQueue, saveFoundSpotifyArtist, setSpotifyArtistByHand } from "../../src/spotify-artists.ts";
import { artistTracksQuery, createSpotify, songQuery, spotifyTrackSearchUrl } from "../../src/spotify.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient, type RecordedResponse } from "../support/fake-http-client.ts";
import { musicbrainzIds, respondWithRecordedMusicBrainz } from "../support/musicbrainz.ts";
import {
  respondWithRecordedSetlistFm,
  setlistFmRateLimitResponse,
  setlistFmRecordedAt,
  setlistFmSetlistsUrl,
} from "../support/setlist-fm.ts";
import {
  predictedArtists,
  quotaExceededResponse,
  rateLimitResponse,
  respondWithRecordedSpotify,
  spotifyIds,
  unlistedTrackSearchFiles,
} from "../support/spotify.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { adminSpotifyUserId, testSettings } from "../support/test-settings.ts";

const settings = defaultPredictionSettings;
const bringMeTheHorizon = predictedArtists[0]!;
const ghostJapan = predictedArtists[1]!;

// The predicted songs of Bring Me the Horizon at the time of the recording, from
// the recorded setlists and track searches: DArkSide, Happy Song, Teardrops,
// Kool-Aid, Shadow Moses, Kingslayer, Can You Feel My Heart, Drown, Throne and Follow You.
const bringMeTheHorizonTracks = [
  "7mczLeiFeYKRb7vtiPjuMb",
  "1yYE8EyuIV0rrvQ1bA2Fyf",
  "3WATWS2Ywo5HeHtG0bE2iZ",
  "0hpWmAB3L0OJ3VBeMkOQUu",
  "68osIGtVjM7QWVe6pazLHj",
  "7CAbF0By0Fpnbiu6Xn5ZF7",
  "0WSa1sucoNRcEeULlZVQXj",
  "6o39Ln9118FKTMbM4BvcEy",
  "0M3adYbGtyRHACP86dey1H",
  "6lFUdRItQEsEuD7dSINL47",
];

// The tracks of the Swedish band Ghost in the Spotify search for "Ghost", one for each title.
const ghostSearchTracks = ["2wBnZdVWa5jVpvYRfGU7rP", "5TNhjanmvwvmjCz2WYwSAv", "4TjCaQsPQhGZUk0Hls4O3Y", "4pIKFpwflOdhYNIRmPTj3E", "4xAmbn7xiy6wGOs4oaxv70"];

function setUp(t: TestContext, predictionSettings: PredictionSettings = settings) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock(setlistFmRecordedAt);
  const appSettings = { ...testSettings(), prediction: predictionSettings };
  createSessions(database, clock, appSettings).logIn({ spotifyUserId: adminSpotifyUserId, displayName: "Kit Admin", refreshToken: "refresh-token-0" });
  const transport = new FakeHttpClient();
  const respondTo = transport.respondTo.bind(transport);
  respondWithRecordedMusicBrainz(respondTo);
  respondWithRecordedSpotify(respondTo);
  respondWithRecordedSetlistFm(respondTo);
  const httpClient = withServiceRules(transport, appSettings, clock);
  const setlistFm = createSetlistFm(httpClient);
  const spotify = createSpotify(httpClient, database, clock, appSettings);
  for (const { musicbrainzId, spotifyArtist } of predictedArtists) {
    saveFoundSpotifyArtist(database, clock, musicbrainzId, { artist: spotifyArtist, source: "musicbrainz" });
  }
  const dependencies = { database, setlistFm, spotify, clock, settings: predictionSettings };
  const prediction = createSongPrediction(dependencies);
  const queue = createPredictedSongQueue(dependencies);
  const sent = (prefix: string) => transport.requests.filter(({ url }) => url.startsWith(prefix));
  return { database, clock, transport, setlistFm, spotify, prediction, queue, httpClient, appSettings, sent };
}

const setlistRequests = "https://api.setlist.fm/";
const trackSearches = "https://api.spotify.com/v1/search";

test("each recorded track search has its query in track-searches.json", () => {
  assert.deepEqual(unlistedTrackSearchFiles(), []);
});

test("setlist.fm gives the shows of an artist, with the tape songs marked", async (t) => {
  const { setlistFm } = setUp(t);

  const result = await setlistFm.artistSetlists(bringMeTheHorizon.musicbrainzId, 1);

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.equal(result.shows.length, 20);
  assert.equal(result.lastPage, false);
  const [first] = result.shows;
  assert.equal(first!.date.toISOString(), "2026-10-11T00:00:00.000Z");
  // The songs of the set and of the encore. "Memorial" is a tape.
  assert.equal(first!.songs.length, 16);
  assert.deepEqual(first!.songs[0], { name: "Pray for Plagues", tape: false });
  assert.deepEqual(first!.songs.find((song) => song.name === "Memorial"), { name: "Memorial", tape: true });
});

test("setlist.fm gives “no setlists” for an artist that it has no setlists of", async (t) => {
  const { setlistFm } = setUp(t);

  // The tribute band "Bring Me the Horizon UK". setlist.fm gives status 404.
  assert.deepEqual(await setlistFm.artistSetlists(musicbrainzIds.bringMeTheHorizonUk, 1), { outcome: "no-setlists" });
});

test("the last page of the setlists is marked", async (t) => {
  const { setlistFm } = setUp(t);

  // The Japanese band "Ghost" has 15 setlists, so they are on one page.
  const result = await setlistFm.artistSetlists(ghostJapan.musicbrainzId, 1);

  assert.equal(result.outcome === "found" && result.lastPage, true);
});

const now = new Date("2027-01-01T00:00:00Z");

function show(date: string, ...songs: (string | { name: string; tape: true })[]): Show {
  return { date: new Date(`${date}T00:00:00Z`), songs: songs.map((song) => (typeof song === "string" ? { name: song, tape: false } : song)) };
}

test("the score of a song is the sum of the weights of its shows, and the weight halves for each 6 months of age", () => {
  const scored = scoreSongs(
    [show("2027-01-01", "Recent", "Both"), show("2026-07-02", "Old", "Both"), show("2026-01-01", "Older")],
    now,
    settings,
  );

  const score = (name: string) => scored.find((song) => song.name === name)?.score;
  assert.equal(score("Recent"), 1);
  assert.ok(Math.abs(score("Old")! - 0.5) < 0.01, `Old: ${score("Old")}`);
  assert.ok(Math.abs(score("Older")! - 0.25) < 0.01, `Older: ${score("Older")}`);
  assert.ok(Math.abs(score("Both")! - 1.5) < 0.01, `Both: ${score("Both")}`);
  assert.deepEqual(
    scored.map((song) => song.name),
    ["Both", "Recent", "Old", "Older"],
    "Recent shows count more than old shows",
  );
});

test("tape songs, shows before the look-back period and a second play in one show do not count", () => {
  const scored = scoreSongs(
    [show("2026-12-01", { name: "Intro", tape: true }, "Song", "Song"), show("2025-06-30", "Before the period")],
    now,
    settings,
  );

  assert.deepEqual(scored.map((song) => song.name), ["Song"]);
  assert.ok(scored[0]!.score < 1);
});

test("the look-back period and the half-life are settings", () => {
  const scored = scoreSongs([show("2026-01-01", "A"), show("2025-01-01", "B")], now, { ...settings, lookBackMonths: 36, halfLifeMonths: 12 });

  assert.deepEqual(scored.map((song) => song.name), ["A", "B"]);
  assert.ok(Math.abs(scored[0]!.score - 0.5) < 0.01);
});

test("a song gets the track of the same artist with the same name, before a live version", () => {
  const tracks = [
    { id: "other", name: "Throne", artistIds: ["someone-else"] },
    { id: "live", name: "Throne - Live at the Royal Albert Hall", artistIds: ["artist"] },
    { id: "studio", name: "Throne", artistIds: ["artist"] },
  ];

  assert.equal(findTrack(tracks, "Throne", "artist")?.id, "studio");
  assert.equal(findTrack(tracks.slice(0, 2), "Throne", "artist")?.id, "live");
  assert.equal(findTrack([{ id: "feat", name: "Kingslayer (feat. BABYMETAL)", artistIds: ["artist"] }], "Kingslayer", "artist")?.id, "feat");
  assert.equal(findTrack(tracks.slice(0, 1), "Throne", "artist"), undefined, "A track of a different artist is not a recording of the song");
});

test("the predicted songs are a maximum of 10 Spotify tracks in order of score", async (t) => {
  const { prediction, sent } = setUp(t);

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  assert.deepEqual(result, { outcome: "predicted", trackIds: bringMeTheHorizonTracks, fallback: false });
  // The setlists of the last 18 months are on 3 pages.
  assert.deepEqual(
    sent(setlistRequests).map(({ url }) => url),
    [1, 2, 3].map((page) => setlistFmSetlistsUrl(bringMeTheHorizon.musicbrainzId, page)),
  );
  // One search for each song, until 10 songs have a track.
  assert.equal(sent(trackSearches).length, 10);
  assert.equal(sent(trackSearches)[0]!.url, spotifyTrackSearchUrl(songQuery("DArkSide", "Bring Me The Horizon")));
});

test("a song with no Spotify recording is not in the result", async (t) => {
  const { prediction, transport } = setUp(t, { ...settings, songCount: 3 });
  // The search for "Happy Song" finds no track.
  transport.respondTo("GET", spotifyTrackSearchUrl(songQuery("Happy Song", "Bring Me The Horizon")), {
    body: JSON.stringify({ tracks: { items: [] } }),
  });

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  // The number of songs is a setting. Kool-Aid takes the place of Happy Song.
  assert.deepEqual(result, { outcome: "predicted", trackIds: [bringMeTheHorizonTracks[0], bringMeTheHorizonTracks[2], bringMeTheHorizonTracks[3]], fallback: false });
});

test("an artist with no setlists in the look-back period gets tracks from a Spotify search, with the fallback mark", async (t) => {
  const { prediction, sent } = setUp(t);

  // The Japanese band "Ghost" has setlists only from 2009. Its Spotify artist is the Swedish band.
  const result = await prediction.predict(ghostJapan.musicbrainzId);

  assert.deepEqual(result, { outcome: "predicted", trackIds: ghostSearchTracks, fallback: true });
  assert.deepEqual(
    sent(trackSearches).map(({ url }) => url),
    [spotifyTrackSearchUrl(artistTracksQuery("Ghost"))],
  );
});

test("an artist that setlist.fm has no setlists of gets the Spotify search fallback", async (t) => {
  const { prediction, transport, database, clock } = setUp(t);
  // The status 404 of the tribute band, for an artist that has a Spotify artist.
  transport.respondTo("GET", setlistFmSetlistsUrl(ghostJapan.musicbrainzId, 1), {
    status: 404,
    body: '{"code":404,"status":"Not Found","message":"not found"}',
  });
  setSpotifyArtistByHand(database, clock, ghostJapan.musicbrainzId, ghostJapan.spotifyArtist);

  assert.deepEqual(await prediction.predict(ghostJapan.musicbrainzId), { outcome: "predicted", trackIds: ghostSearchTracks, fallback: true });
});

test("an artist without a Spotify artist gets no calculation", async (t) => {
  const { prediction, database, clock, transport } = setUp(t);
  saveFoundSpotifyArtist(database, clock, musicbrainzIds.bringMeTheHorizonUk, undefined);

  assert.deepEqual(await prediction.predict(musicbrainzIds.bringMeTheHorizonUk), { outcome: "no-spotify-artist" });
  assert.equal(transport.requests.length, 0);
});

test("the store contains only the Spotify track IDs, the mark and the calculation time", async (t) => {
  const { queue, database } = setUp(t);

  queue.calculate([bringMeTheHorizon.musicbrainzId, ghostJapan.musicbrainzId]);
  await queue.idle();

  const columns = database.prepare("SELECT name FROM pragma_table_info('predicted_songs')").all().map((row) => row.name);
  assert.deepEqual(columns, ["musicbrainz_id", "track_ids", "fallback", "calculated_at"]);
  const rows = database.prepare("SELECT * FROM predicted_songs ORDER BY musicbrainz_id").all();
  // The calculation time is the end of the calculation. The pauses between requests move the fake clock.
  for (const row of rows) assert.ok(new Date(String(row.calculated_at)) >= setlistFmRecordedAt);
  assert.deepEqual(
    rows.map(({ musicbrainz_id, track_ids, fallback }) => ({ musicbrainz_id, track_ids, fallback })),
    [
      { musicbrainz_id: bringMeTheHorizon.musicbrainzId, track_ids: JSON.stringify(bringMeTheHorizonTracks), fallback: 0 },
      { musicbrainz_id: ghostJapan.musicbrainzId, track_ids: JSON.stringify(ghostSearchTracks), fallback: 1 },
    ],
  );
  // No other table has setlist.fm data, for example a song name.
  const tables = database.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all();
  for (const { name } of tables) {
    const text = JSON.stringify(database.prepare(`SELECT * FROM "${String(name)}"`).all());
    assert.ok(!/Shadow Moses|setlist/i.test(text), `The table ${String(name)} contains setlist.fm data`);
  }
});

test("a result stays valid for 6 months, so a second calculation inside that period sends no request", async (t) => {
  const { queue, clock, transport, sent, database } = setUp(t);
  queue.calculate([bringMeTheHorizon.musicbrainzId]);
  await queue.idle();
  const first = transport.requests.length;

  // A second festival with the same artist, 5 months later.
  clock.advance(150 * 24 * 60 * 60 * 1000);
  queue.calculate([bringMeTheHorizon.musicbrainzId]);
  await queue.idle();
  assert.equal(transport.requests.length, first, "No new calculation");

  // 7 months after the calculation, the result is not valid. The new calculation
  // gets the setlists again. (Its Spotify searches are not recorded, so it does not complete.)
  clock.set(new Date("2027-06-20T00:00:00Z"));
  queue.calculate([bringMeTheHorizon.musicbrainzId]);
  await queue.idle();
  assert.ok(sent(setlistRequests).length > 3, "A new calculation");
  assert.ok(findPredictedSongs(database, bringMeTheHorizon.musicbrainzId) !== undefined);
});

test("a recalculation replaces a valid result", async (t) => {
  const { queue, clock, database, sent } = setUp(t);
  queue.calculate([bringMeTheHorizon.musicbrainzId]);
  await queue.idle();
  const first = findPredictedSongs(database, bringMeTheHorizon.musicbrainzId)!.calculatedAt;
  clock.advance(60 * 60 * 1000);

  queue.calculate([bringMeTheHorizon.musicbrainzId], { again: true });
  await queue.idle();

  assert.equal(sent(setlistRequests).length, 6);
  const second = findPredictedSongs(database, bringMeTheHorizon.musicbrainzId)!;
  assert.ok(second.calculatedAt.getTime() > first.getTime() + 60 * 60 * 1000);
  assert.deepEqual(second.trackIds, bringMeTheHorizonTracks);
});

// Gives `response` to the first request to `url`, then the recorded response.
function limitOnce(transport: FakeHttpClient, url: string, response: RecordedResponse): void {
  const send = transport.send.bind(transport);
  let limited = false;
  transport.send = async (request) => {
    if (!limited && request.url === url) {
      limited = true;
      transport.requests.push({ method: request.method, url: request.url });
      return new Response(response.body, { status: response.status, headers: response.headers });
    }
    return send(request);
  };
}

test("a setlist.fm rate limit during the calculation of a lineup delays the calculation but does not stop it", async (t) => {
  const { queue, transport, clock, database } = setUp(t);
  limitOnce(transport, setlistFmSetlistsUrl(bringMeTheHorizon.musicbrainzId, 2), setlistFmRateLimitResponse);
  const limitedAt = clock.now().getTime();

  queue.calculate([bringMeTheHorizon.musicbrainzId, ghostJapan.musicbrainzId]);
  await queue.idle();

  assert.equal(queue.state().problem, undefined);
  assert.deepEqual(findPredictedSongs(database, bringMeTheHorizon.musicbrainzId)?.trackIds, bringMeTheHorizonTracks);
  assert.deepEqual(findPredictedSongs(database, ghostJapan.musicbrainzId)?.trackIds, ghostSearchTracks);
  assert.ok(clock.sleeps.includes(setlistFmLimitWait), `The calculation waited: ${clock.sleeps.join(", ")}`);
  assert.ok(clock.now().getTime() - limitedAt >= setlistFmLimitWait);
});

test("a long Spotify rate limit during the calculation delays the calculation but does not stop it", async (t) => {
  const { queue, transport, clock, database } = setUp(t);
  // 10 minutes is longer than the HTTP client waits, so the HTTP client refuses the requests until then.
  limitOnce(transport, spotifyTrackSearchUrl(songQuery("Teardrops", "Bring Me The Horizon")), rateLimitResponse(600));

  queue.calculate([bringMeTheHorizon.musicbrainzId]);
  await queue.idle();

  assert.equal(queue.state().problem, undefined);
  assert.deepEqual(findPredictedSongs(database, bringMeTheHorizon.musicbrainzId)?.trackIds, bringMeTheHorizonTracks);
  assert.ok(clock.sleeps.includes(600_000), `The calculation waited 10 minutes: ${clock.sleeps.join(", ")}`);
});

test("a Spotify quota error stops the calculations with its cause", async (t) => {
  const { queue, transport, database } = setUp(t);
  transport.respondTo("GET", spotifyTrackSearchUrl(songQuery("DArkSide", "Bring Me The Horizon")), quotaExceededResponse);

  queue.calculate([bringMeTheHorizon.musicbrainzId, ghostJapan.musicbrainzId]);
  await queue.idle();

  assert.match(queue.state().problem?.cause ?? "", /used all of its Spotify quota/);
  assert.equal(findPredictedSongs(database, bringMeTheHorizon.musicbrainzId), undefined);
  assert.equal(findPredictedSongs(database, ghostJapan.musicbrainzId), undefined, "The first failure stops the run");
});

test("the calculation does not make the caller wait", async (t) => {
  const { queue, transport } = setUp(t);
  let release: () => void = () => undefined;
  const send = transport.send.bind(transport);
  transport.send = async (request) => {
    await new Promise<void>((resolve) => (release = resolve));
    return send(request);
  };

  queue.calculate([bringMeTheHorizon.musicbrainzId]);

  assert.equal(queue.state().running, true);
  assert.equal(queue.isWaiting(bringMeTheHorizon.musicbrainzId), true);
  transport.send = send;
  release();
  await queue.idle();
  assert.equal(queue.isWaiting(bringMeTheHorizon.musicbrainzId), false);
});

test("a find of a Spotify artist reports a different Spotify artist, so that the predicted songs are calculated again", async (t) => {
  const { database, clock, httpClient, appSettings } = setUp(t);
  const spotify = createSpotify(httpClient, database, clock, appSettings);
  const found: [string, boolean][] = [];
  const spotifyArtists = createSpotifyArtistQueue(database, createMusicBrainz(httpClient), spotify, clock, (id, changed) => found.push([id, changed]));
  const artist = { id: musicbrainzIds.bringMeTheHorizon, name: "Bring Me the Horizon", aliases: [], ended: false, genres: [], score: 100, votes: 0 };
  // The stored Spotify artist is different from the MusicBrainz link.
  setSpotifyArtistByHand(database, clock, artist.id, { id: spotifyIds.ghostSweden, name: "Ghost" });
  database.prepare("UPDATE spotify_artist SET source = 'search' WHERE musicbrainz_id = ?").run(artist.id);

  spotifyArtists.find([artist]);
  await spotifyArtists.idle();
  spotifyArtists.find([artist], { again: true });
  await spotifyArtists.idle();

  assert.deepEqual(found, [
    [artist.id, false],
    [artist.id, true],
  ]);
});
