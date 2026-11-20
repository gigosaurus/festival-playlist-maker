import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { setlistFmLimitWait, withServiceRules } from "../../src/http-client.ts";
import { createMusicBrainz, musicbrainzAlbumsUrl, musicbrainzEventsUrl } from "../../src/musicbrainz.ts";
import {
  createPredictedSongQueue,
  createSongPrediction,
  findPredictedSongs,
  findTrack,
  findVenueDate,
  hasLongLookBack,
  isAlbumFocused,
  lookBackShows,
  lookBackStart,
  saveVenueDate,
  scoreSongs,
  songsToFind,
  type CheckedShow,
} from "../../src/predicted-songs.ts";
import { createSessions } from "../../src/sessions.ts";
import { createSetlistFm, type SetlistFm, type SetlistPageResult, type Show } from "../../src/setlist-fm.ts";
import { defaultPredictionSettings, type PredictionSettings } from "../../src/settings.ts";
import { createSpotifyArtistQueue, saveFoundSpotifyArtist, setSpotifyArtistByHand } from "../../src/spotify-artists.ts";
import { artistTracksQuery, createSpotify, songQuery, spotifyTrackSearchUrl } from "../../src/spotify.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient, type RecordedResponse } from "../support/fake-http-client.ts";
import { busyResponse, musicbrainzIds, respondWithRecordedMusicBrainz } from "../support/musicbrainz.ts";
import {
  recordedVenueDates,
  respondWithRecordedSetlistFm,
  setlistFmRateLimitResponse,
  setlistFmRecordedAt,
  setlistFmSetlistsUrl,
  setlistFmVenueSetlistsUrl,
} from "../support/setlist-fm.ts";
import {
  limpBizkitSpotifyId,
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
  const musicBrainz = createMusicBrainz(httpClient);
  const spotify = createSpotify(httpClient, database, clock, appSettings);
  for (const { musicbrainzId, spotifyArtist } of predictedArtists) {
    saveFoundSpotifyArtist(database, clock, musicbrainzId, { artist: spotifyArtist, source: "musicbrainz" });
  }
  const dependencies = { database, setlistFm, musicBrainz, spotify, clock, settings: predictionSettings };
  const prediction = createSongPrediction(dependencies);
  const queue = createPredictedSongQueue(dependencies);
  const sent = (prefix: string) => transport.requests.filter(({ url }) => url.startsWith(prefix));
  return { database, clock, transport, setlistFm, musicBrainz, spotify, prediction, queue, httpClient, appSettings, sent };
}

const setlistRequests = "https://api.setlist.fm/";
const musicbrainzEventRequests = "https://musicbrainz.org/ws/2/event";
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
  assert.deepEqual(first!.songs[0], { name: "Pray for Plagues", tape: false, cover: false });
  assert.deepEqual(first!.songs.find((song) => song.name === "Memorial"), { name: "Memorial", tape: true, cover: false });
  assert.equal(first!.venueId, "3bd634d0");
  assert.equal(first!.tour, "Count Your Blessings | Repented");
});

// Reading Festival 2025 (Little John's Farm) and Hellfest 2026 (Mainstage 01).
const reading = { venueId: "63d6cecf", date: new Date("2025-08-23T00:00:00Z") };
const hellfestMainStage = { venueId: "43df83a7", date: new Date("2026-06-18T00:00:00Z") };
// Two shows that are not festival sets: Madison Square Garden (4 artists), and
// Las Vegas "Purple Stage" (8 artists), which is not a festival on MusicBrainz.
const madisonSquareGarden = { venueId: "23d63cc7", date: new Date("2026-05-02T00:00:00Z") };
const purpleStage = { venueId: "7bdf8eac", date: new Date("2026-04-25T00:00:00Z") };

test("setlist.fm gives the number of artists at a venue on a date", async (t) => {
  const { setlistFm } = setUp(t);

  // Reading has 45 setlists on 3 pages, so the count is the total.
  assert.deepEqual(await setlistFm.venueArtists(reading.venueId, reading.date), { outcome: "found", artists: 45 });
  // setlist.fm has a venue for each stage of some festivals. The main stage of Hellfest has 5 artists on that date.
  assert.deepEqual(await setlistFm.venueArtists(hellfestMainStage.venueId, hellfestMainStage.date), { outcome: "found", artists: 5 });
});

test("setlist.fm gives 0 artists for a venue and date with no setlists", async (t) => {
  const { setlistFm, transport } = setUp(t);
  transport.respondTo("GET", setlistFmVenueSetlistsUrl("unknown", reading.date), {
    status: 404,
    body: '{"code":404,"status":"Not Found","message":"not found"}',
  });

  assert.deepEqual(await setlistFm.venueArtists("unknown", reading.date), { outcome: "found", artists: 0 });
});

test("one artist with two setlists on one date is one artist", async (t) => {
  const { setlistFm, transport } = setUp(t);
  const setlist = (mbid: string) => ({ artist: { mbid, name: mbid }, eventDate: "23-08-2025" });
  transport.respondTo("GET", setlistFmVenueSetlistsUrl("club", reading.date), {
    body: JSON.stringify({ setlist: [setlist("a"), setlist("a"), setlist("b")], total: 3, page: 1, itemsPerPage: 20 }),
  });

  assert.deepEqual(await setlistFm.venueArtists("club", reading.date), { outcome: "found", artists: 2 });
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

// The festival days of Bring Me the Horizon in the look-back period, in the recorded
// MusicBrainz events: Rock am Ring, Rock im Park, Sweden Rock, Rock for People,
// Nova Rock, Hellfest, Graspop, Tons of Rock, Tuska, Rock in Rio and Furnace Fest.
const musicbrainzFestivalDays = [
  "2025-06-06", "2025-06-08", "2026-06-06", "2026-06-12", "2026-06-14", "2026-06-18", "2026-06-20", "2026-06-24", "2026-06-28", "2026-09-05", "2026-10-11",
];
// The dates with 10 or more artists at the venue in the recorded setlist.fm searches:
// Reading, Leeds, Louder Than Life, Rock for People, Tons of Rock, Provinssi, Tuska, Sziget and Furnace Fest.
const setlistFmFestivalDays = ["2025-08-23", "2025-08-24", "2025-09-21", "2026-06-12", "2026-06-24", "2026-06-27", "2026-06-28", "2026-08-14", "2026-10-11"];
// The festival sets: the dates from MusicBrainz or from setlist.fm.
const recordedFestivalSets = [...new Set([...musicbrainzFestivalDays, ...setlistFmFestivalDays])].sort();

function show(date: string, ...songs: (string | { name: string; tape?: boolean; cover?: boolean })[]): CheckedShow {
  return {
    date: new Date(`${date}T00:00:00Z`),
    songs: songs.map((song) =>
      typeof song === "string" ? { name: song, tape: false, cover: false } : { tape: false, cover: false, ...song },
    ),
    festivalSet: false,
    albumFocused: false,
  };
}

function festivalSet(date: string, ...songs: string[]): CheckedShow {
  return { ...show(date, ...songs), festivalSet: true };
}

function tourShow(tour: string, date: string, ...songs: string[]): CheckedShow {
  return { ...show(date, ...songs), tour };
}

function scoreOf(scored: { name: string; score: number }[], name: string): number | undefined {
  return scored.find((song) => song.name === name)?.score;
}

function near(actual: number | undefined, expected: number, message: string): void {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 0.01, `${message}: ${actual}, not ${expected}`);
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

test("a festival set counts 2", () => {
  const scored = scoreSongs([festivalSet("2027-01-01", "Festival"), show("2027-01-01", "Club")], now, settings);

  near(scoreOf(scored, "Festival"), 2, "Festival");
  near(scoreOf(scored, "Club"), 1, "Club");
  assert.deepEqual(scored.map((song) => song.name), ["Festival", "Club"], "Festival sets count more than tour shows");
});

test("all the shows of one tour together count a maximum of 3 shows", () => {
  const longTour = ["2027-01-01", "2027-01-01", "2027-01-01", "2027-01-01", "2027-01-01", "2027-01-01"].map((date) =>
    tourShow("Arena Tour", date, "Tour song"),
  );
  const scored = scoreSongs([...longTour, tourShow("Short Tour", "2027-01-01", "Short tour song"), show("2027-01-01", "One-off")], now, settings);

  // 6 shows of one tour count 3. Each show counts 3/6.
  near(scoreOf(scored, "Tour song"), 3, "Tour song");
  near(scoreOf(scored, "Short tour song"), 1, "A tour with 3 shows or fewer");
  near(scoreOf(scored, "One-off"), 1, "A show without a tour");
});

test("the tour limit keeps the age of each show", () => {
  const scored = scoreSongs(
    [1, 2, 3, 4].map(() => tourShow("Tour", "2027-01-01", "New")).concat([1, 2, 3, 4].map(() => tourShow("Tour", "2026-07-02", "Old"))),
    now,
    settings,
  );

  // 8 shows count 3, so each show counts 3/8 of its weight.
  near(scoreOf(scored, "New"), 4 * (3 / 8), "New");
  near(scoreOf(scored, "Old"), 4 * (3 / 8) * 0.5, "Old");
});

test("festival sets with a tour name are not in the tour limit", () => {
  // setlist.fm often gives a tour name, for example "Summer Shows 2026", to festival sets.
  const scored = scoreSongs(
    [
      ...[1, 2, 3, 4, 5].map(() => ({ ...festivalSet("2027-01-01", "Festival song"), tour: "Summer Shows" })),
      ...[1, 2, 3, 4].map(() => tourShow("Summer Shows", "2027-01-01", "Club song")),
    ],
    now,
    settings,
  );

  near(scoreOf(scored, "Festival song"), 10, "Festival song");
  near(scoreOf(scored, "Club song"), 3, "Club song");
});

test("the festival set weight and the tour limit are settings", () => {
  const shows = [festivalSet("2027-01-01", "Festival"), ...[1, 2, 3, 4].map(() => tourShow("Tour", "2027-01-01", "Tour song"))];

  const scored = scoreSongs(shows, now, { ...settings, festivalSetWeight: 5, tourShowLimit: 2 });

  near(scoreOf(scored, "Festival"), 5, "Festival");
  near(scoreOf(scored, "Tour song"), 2, "Tour song");
});

test("the recorded shows of Bring Me the Horizon: festival sets count more than the shows of a long tour", async (t) => {
  const { setlistFm } = setUp(t);
  const shows: Show[] = [];
  for (const page of [1, 2, 3]) {
    const result = await setlistFm.artistSetlists(bringMeTheHorizon.musicbrainzId, page);
    if (result.outcome === "found") shows.push(...result.shows);
  }
  const festivalSets = new Set(recordedFestivalSets);
  const checked = shows.map((each) => ({ ...each, festivalSet: festivalSets.has(each.date.toISOString().slice(0, 10)), albumFocused: false }));
  const before = scoreSongs(checked.map((each) => ({ ...each, festivalSet: false, tour: undefined })), setlistFmRecordedAt, settings);
  const after = scoreSongs(checked, setlistFmRecordedAt, settings);
  const position = (scored: { name: string }[], name: string) => scored.findIndex((song) => song.name === name);

  // "The House of Wolves" is mostly from the 17 shows of "N. American Ascension Program 2".
  // "AmEN!" is mostly from festival sets.
  assert.ok(position(before, "The House of Wolves") < position(before, "AmEN!"));
  assert.ok(position(after, "AmEN!") < position(after, "The House of Wolves"));
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

  assert.deepEqual(result, { outcome: "predicted", trackIds: bringMeTheHorizonTracks, fallback: false, lookBackMonths: 18 });
  // The setlists of the last 18 months are on 3 pages. Then 1 MusicBrainz request
  // for the festivals, and 1 setlist.fm search for each venue and date that is not a MusicBrainz festival day.
  const urls = sent(setlistRequests).map(({ url }) => url);
  assert.deepEqual(
    urls.slice(0, 3),
    [1, 2, 3].map((page) => setlistFmSetlistsUrl(bringMeTheHorizon.musicbrainzId, page)),
  );
  assert.deepEqual(sent(musicbrainzEventRequests).map(({ url }) => url), [musicbrainzEventsUrl(bringMeTheHorizon.musicbrainzId, 0)]);
  assert.deepEqual(
    new Set(urls.slice(3)),
    new Set(
      recordedVenueDates()
        .filter(({ date }) => date >= lookBackStart(setlistFmRecordedAt, settings))
        .filter(({ date }) => !musicbrainzFestivalDays.includes(date.toISOString().slice(0, 10)))
        .map(({ venueId, date }) => setlistFmVenueSetlistsUrl(venueId, date)),
    ),
  );
  // One search for each song, until 10 songs have a track.
  assert.equal(sent(trackSearches).length, 10);
  assert.equal(sent(trackSearches)[0]!.url, spotifyTrackSearchUrl(songQuery("DArkSide", "Bring Me The Horizon")));
});

test("a show is a festival set when MusicBrainz has a festival of the artist on the date, or when setlist.fm has 10 or more artists at the venue", async (t) => {
  const { prediction, database, sent } = setUp(t);

  await prediction.predict(bringMeTheHorizon.musicbrainzId);

  const festivalSets = database.prepare("SELECT date FROM venue_date WHERE festival_set = 1 ORDER BY date").all().map(({ date }) => date);
  assert.deepEqual(festivalSets, recordedFestivalSets);
  // Hellfest has only 5 artists at "Mainstage 01" on setlist.fm, but MusicBrainz has the festival. No setlist.fm search is necessary.
  assert.equal(findVenueDate(database, hellfestMainStage.venueId, hellfestMainStage.date)?.festivalSet, true);
  assert.ok(!sent(setlistRequests).some(({ url }) => url === setlistFmVenueSetlistsUrl(hellfestMainStage.venueId, hellfestMainStage.date)));
  assert.equal(findVenueDate(database, madisonSquareGarden.venueId, madisonSquareGarden.date)?.festivalSet, false);
  assert.equal(findVenueDate(database, purpleStage.venueId, purpleStage.date)?.festivalSet, false);
});

test("MusicBrainz gives the days of the festival events of an artist", async (t) => {
  const { musicBrainz } = setUp(t);

  const result = await musicBrainz.festivalDays(bringMeTheHorizon.musicbrainzId);

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  // A festival day, and a festival of 3 days. "Outbreak Presents" in Manchester is a concert, so it is not in the result.
  assert.ok(result.festivals.some(({ begin, end }) => begin === "2026-06-18" && end === "2026-06-18"), "Hellfest 2026, Thursday");
  assert.ok(result.festivals.some(({ begin, end }) => begin === "2027-06-04" && end === "2027-06-06"), "Rock am Ring 2027");
  assert.ok(!result.festivals.some(({ begin }) => begin === "2026-07-10"));
});

test("a MusicBrainz failure stops the calculation with its cause", async (t) => {
  const { prediction, transport, database } = setUp(t);
  transport.respondTo("GET", musicbrainzEventsUrl(bringMeTheHorizon.musicbrainzId, 0), busyResponse);

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  assert.equal(result.outcome, "failed");
  assert.match(result.outcome === "failed" ? result.cause : "", /MusicBrainz was busy/);
  assert.equal(findVenueDate(database, madisonSquareGarden.venueId, madisonSquareGarden.date), undefined);
});

test("an artist with no shows in the look-back period gets no MusicBrainz request", async (t) => {
  const { prediction, sent } = setUp(t);

  await prediction.predict(ghostJapan.musicbrainzId);

  assert.deepEqual(sent(musicbrainzEventRequests), []);
});

test("the result for each venue and date is stored and used again without a new setlist.fm request", async (t) => {
  const { prediction, sent } = setUp(t);
  await prediction.predict(bringMeTheHorizon.musicbrainzId);
  const first = sent(setlistRequests).length;

  await prediction.predict(bringMeTheHorizon.musicbrainzId);

  // Only the 3 setlist pages again.
  assert.equal(sent(setlistRequests).length, first + 3);
});

test("a result “not a festival set” from less than 30 days after the date is checked again", async (t) => {
  const { prediction, database, sent } = setUp(t);
  const day = 24 * 60 * 60 * 1000;
  // Reading, checked 2 days after the date, when setlist.fm had few setlists.
  saveVenueDate(database, reading.venueId, reading.date, { festivalSet: false, checkedAt: new Date(reading.date.getTime() + 2 * day) });
  // Madison Square Garden, checked 40 days after the date.
  saveVenueDate(database, madisonSquareGarden.venueId, madisonSquareGarden.date, {
    festivalSet: false,
    checkedAt: new Date(madisonSquareGarden.date.getTime() + 40 * day),
  });

  await prediction.predict(bringMeTheHorizon.musicbrainzId);

  const urls = sent(setlistRequests).map(({ url }) => url);
  assert.ok(urls.includes(setlistFmVenueSetlistsUrl(reading.venueId, reading.date)));
  assert.ok(!urls.includes(setlistFmVenueSetlistsUrl(madisonSquareGarden.venueId, madisonSquareGarden.date)));
  assert.equal(findVenueDate(database, reading.venueId, reading.date)?.festivalSet, true);
});

test("the festival set threshold is a setting", async (t) => {
  const { prediction, database } = setUp(t, { ...settings, festivalSetArtists: 8 });

  await prediction.predict(bringMeTheHorizon.musicbrainzId);

  assert.equal(findVenueDate(database, purpleStage.venueId, purpleStage.date)?.festivalSet, true);
});

test("a song with no Spotify recording is not in the result", async (t) => {
  const { prediction, transport } = setUp(t, { ...settings, songCount: 3 });
  // The search for "Happy Song" finds no track.
  transport.respondTo("GET", spotifyTrackSearchUrl(songQuery("Happy Song", "Bring Me The Horizon")), {
    body: JSON.stringify({ tracks: { items: [] } }),
  });

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  // The number of songs is a setting. Kool-Aid takes the place of Happy Song.
  assert.deepEqual(result, {
    outcome: "predicted",
    trackIds: [bringMeTheHorizonTracks[0], bringMeTheHorizonTracks[2], bringMeTheHorizonTracks[3]],
    fallback: false,
    lookBackMonths: 18,
  });
});

test("an artist with no setlists in the look-back period gets tracks from a Spotify search, with the fallback mark", async (t) => {
  const { prediction, sent } = setUp(t);

  // The Japanese band "Ghost" has setlists only from 2009. Its Spotify artist is the Swedish band.
  const result = await prediction.predict(ghostJapan.musicbrainzId);

  // The look-back period is the longest one, because the artist has fewer than 5 shows in each period.
  assert.deepEqual(result, { outcome: "predicted", trackIds: ghostSearchTracks, fallback: true, lookBackMonths: 60 });
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

  assert.deepEqual(await prediction.predict(ghostJapan.musicbrainzId), {
    outcome: "predicted",
    trackIds: ghostSearchTracks,
    fallback: true,
    lookBackMonths: 60,
  });
});

test("an artist without a Spotify artist gets no calculation", async (t) => {
  const { prediction, database, clock, transport } = setUp(t);
  saveFoundSpotifyArtist(database, clock, musicbrainzIds.bringMeTheHorizonUk, undefined);

  assert.deepEqual(await prediction.predict(musicbrainzIds.bringMeTheHorizonUk), { outcome: "no-spotify-artist" });
  assert.equal(transport.requests.length, 0);
});

test("the store contains only the Spotify track IDs, the marks and the calculation time", async (t) => {
  const { queue, database } = setUp(t);

  queue.calculate([bringMeTheHorizon.musicbrainzId, ghostJapan.musicbrainzId]);
  await queue.idle();

  const columns = database.prepare("SELECT name FROM pragma_table_info('predicted_songs')").all().map((row) => row.name);
  assert.deepEqual(columns, ["musicbrainz_id", "track_ids", "fallback", "calculated_at", "look_back_months"]);
  // The venue-and-date results keep only the venue ID, the date and the result.
  const venueColumns = database.prepare("SELECT name FROM pragma_table_info('venue_date')").all().map((row) => row.name);
  assert.deepEqual(venueColumns, ["venue_id", "date", "festival_set", "checked_at"]);
  const rows = database.prepare("SELECT * FROM predicted_songs ORDER BY musicbrainz_id").all();
  // The calculation time is the end of the calculation. The pauses between requests move the fake clock.
  for (const row of rows) assert.ok(new Date(String(row.calculated_at)) >= setlistFmRecordedAt);
  assert.deepEqual(
    rows.map(({ musicbrainz_id, track_ids, fallback, look_back_months }) => ({ musicbrainz_id, track_ids, fallback, look_back_months })),
    [
      { musicbrainz_id: bringMeTheHorizon.musicbrainzId, track_ids: JSON.stringify(bringMeTheHorizonTracks), fallback: 0, look_back_months: 18 },
      { musicbrainz_id: ghostJapan.musicbrainzId, track_ids: JSON.stringify(ghostSearchTracks), fallback: 1, look_back_months: 60 },
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
  const firstRequests = sent(setlistRequests).length;
  clock.advance(60 * 60 * 1000);

  queue.calculate([bringMeTheHorizon.musicbrainzId], { again: true });
  await queue.idle();

  // The second calculation gets the 3 setlist pages again, and uses the stored venue-and-date results.
  assert.equal(sent(setlistRequests).length, firstRequests + 3);
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

// Issue #14: album-focused shows, covers and the long look-back.

// Geese released "Getting Killed" on 26 September 2025. Most shows of its tour have
// more than half of their songs from that album.
const geese = "e0c97a4d-c392-41a9-a374-57af3e3eeab3";
// Limp Bizkit plays the covers "Behind Blue Eyes" (The Who) and "Faith" (George Michael).
const limpBizkit = "8f9d6bb2-dba4-4cca-9967-cc02b9f4820c";

const albumRequests = "https://musicbrainz.org/ws/2/release";

async function recordedShows(setlistFm: SetlistFm, musicbrainzId: string): Promise<{ shows: Show[]; lookBackMonths: number }> {
  const result = await lookBackShows((page) => setlistFm.artistSetlists(musicbrainzId, page), setlistFmRecordedAt, settings);
  assert.ok(!("cause" in result));
  return result;
}

function position(scored: { name: string }[], name: string): number {
  const index = scored.findIndex((song) => song.name === name);
  assert.ok(index >= 0, `${name} is in the result`);
  return index;
}

test("MusicBrainz gives the studio albums of an artist from a date, with the songs of the first release", async (t) => {
  const { musicBrainz } = setUp(t);

  const result = await musicBrainz.albums(geese, "2021-01-01");

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  // The 4 live albums of Geese since 2021 are not in the result. "Getting Killed" has 11 tracks.
  assert.deepEqual(
    result.albums.map(({ title, released }) => `${title} ${released}`).sort(),
    ["3D Country 2023-06-03", "Getting Killed 2025-09-26", "Projector 2021-10-29"],
  );
  const gettingKilled = result.albums.find(({ title }) => title === "Getting Killed")!;
  assert.equal(gettingKilled.songs.length, 11);
  assert.ok(gettingKilled.songs.includes("Trinidad"));
});

test("MusicBrainz gives no live album or remix album, and no album before the date", async (t) => {
  const { musicBrainz, sent } = setUp(t);

  const result = await musicBrainz.albums(bringMeTheHorizon.musicbrainzId, "2024-05-19");

  // Bring Me the Horizon also has "L.I.V.E. in São Paulo" (live) and "Wish I Could Forget (The Remixes)" (remix) in this period.
  assert.deepEqual(
    result.outcome === "found" ? result.albums.map(({ title }) => title).sort() : result,
    ["Count Your Blessings | Repented", "Lo-files", "POST HUMAN: NeX GEn"],
  );
  // 1 request for the albums, and 1 request for the releases of each album in the result.
  assert.equal(sent(albumRequests).length, 4);
});

test("setlist.fm marks the covers", async (t) => {
  const { setlistFm } = setUp(t);

  const { shows } = await recordedShows(setlistFm, limpBizkit);

  const songs = shows.flatMap((each) => each.songs);
  assert.equal(songs.find((song) => song.name === "Faith")?.cover, true);
  assert.equal(songs.find((song) => song.name === "Break Stuff")?.cover, false);
});

const album = { title: "New Album", released: "2026-11-01", songs: ["New 1", "New 2", "New 3"] };

test("a show is album-focused when more than half of its songs come from one album released in the 12 months before the show", () => {
  const focused = show("2026-12-01", "New 1", "New 2", "Old", { name: "Intro", tape: true });
  const half = show("2026-12-01", "New 1", "New 2", "Old", "Older");
  const beforeTheAlbum = show("2026-10-31", "New 1", "New 2", "Old");
  const aYearLater = show("2027-11-02", "New 1", "New 2", "Old");

  assert.equal(isAlbumFocused(focused, [album], settings), true, "2 of 3 songs. A tape song is not a song of the show.");
  assert.equal(isAlbumFocused(half, [album], settings), false, "Half of the songs is not more than half");
  assert.equal(isAlbumFocused(beforeTheAlbum, [album], settings), false);
  assert.equal(isAlbumFocused(aYearLater, [album], settings), false, "The album was released more than 12 months before the show");
  assert.equal(isAlbumFocused(show("2027-10-31", "New 1", "New 2", "Old"), [album], settings), true);
});

test("an album-focused show counts 0.1", () => {
  const scored = scoreSongs(
    [
      { ...show("2027-01-01", "New 1", "New 2"), albumFocused: true },
      { ...festivalSet("2027-01-01", "Festival"), albumFocused: true },
      show("2027-01-01", "Other"),
    ],
    now,
    settings,
  );

  near(scoreOf(scored, "New 1"), 0.1, "New 1");
  near(scoreOf(scored, "Festival"), 0.2, "An album-focused festival set");
  near(scoreOf(scored, "Other"), 1, "Other");
});

test("the numbers of the album-focused rule are settings", () => {
  const changed = { ...settings, albumFocusedShare: 0.4, albumFocusedMonths: 24, albumFocusedWeight: 0.5 };

  assert.equal(isAlbumFocused(show("2027-12-01", "New 1", "New 2", "Old", "Older"), [album], changed), true);
  near(scoreOf(scoreSongs([{ ...show("2027-01-01", "New 1"), albumFocused: true }], now, changed), "New 1"), 0.5, "New 1");
});

test("the recorded shows of Geese: the songs of a new album do not fill the predicted songs", async (t) => {
  const { setlistFm, musicBrainz } = setUp(t);
  const { shows } = await recordedShows(setlistFm, geese);
  const albums = await musicBrainz.albums(geese, "2024-05-19");
  assert.equal(albums.outcome, "found");
  if (albums.outcome !== "found") return;
  const checked = shows.map((each) => ({ ...each, festivalSet: false, albumFocused: isAlbumFocused(each, albums.albums, settings) }));
  const at = (date: string) => checked.find((each) => each.date.toISOString().startsWith(date))!;

  // X-TRA, Zürich: 10 of 14 songs from "Getting Killed". The Anthem, Washington: 11 of 16,
  // but more than 12 months after the release.
  assert.equal(at("2026-03-11").albumFocused, true);
  assert.equal(at("2026-11-13").albumFocused, false);
  const before = scoreSongs(checked.map((each) => ({ ...each, albumFocused: false })), setlistFmRecordedAt, settings);
  const after = scoreSongs(checked, setlistFmRecordedAt, settings);
  // "2122" is from the album "Projector" (2021). "Trinidad" is from "Getting Killed".
  assert.ok(position(before, "Trinidad") < position(before, "2122"));
  assert.ok(position(after, "2122") < position(after, "Trinidad"));
});

test("a cover is kept only when it is in the top songs", () => {
  const scored = scoreSongs(
    [show("2027-01-01", "A", { name: "Top cover", cover: true }, "B", { name: "Rare cover", cover: true }, "C")],
    now,
    settings,
  );

  // All the songs have the same score, so the order of the show decides.
  assert.deepEqual(songsToFind(scored, { ...settings, coverTopSongs: 3 }).map((song) => song.name), ["A", "Top cover", "B", "C"]);
  assert.deepEqual(songsToFind(scored, { ...settings, coverTopSongs: 1 }).map((song) => song.name), ["A", "B", "C"], "The number is a setting");
});

test("the recorded shows of Limp Bizkit: the cover in the top 10 songs is searched, the cover after it is not", async (t) => {
  const { setlistFm } = setUp(t);
  const { shows } = await recordedShows(setlistFm, limpBizkit);
  const scored = scoreSongs(
    shows.map((each) => ({ ...each, festivalSet: false, albumFocused: false })),
    setlistFmRecordedAt,
    settings,
  );

  assert.equal(position(scored, "Behind Blue Eyes"), 9);
  assert.equal(position(scored, "Faith"), 10);
  const names = songsToFind(scored, settings).map((song) => song.name);
  assert.ok(names.includes("Behind Blue Eyes"));
  assert.ok(!names.includes("Faith"));
  assert.ok(names.includes("Eat You Alive"), "A song that is not a cover stays after the 10th song");
});

test("Spotify has the recording of a cover by the performing artist", async (t) => {
  const { spotify } = setUp(t);

  const result = await spotify.searchTracks(songQuery("Behind Blue Eyes", "Limp Bizkit"));

  assert.equal(result.outcome, "found");
  if (result.outcome !== "found") return;
  assert.ok(findTrack(result.tracks, "Behind Blue Eyes", limpBizkitSpotifyId) !== undefined);
  // A recording by a different artist is not a recording of the cover.
  const byTheWho = result.tracks.map((track) => ({ ...track, artistIds: ["the-who"] }));
  assert.equal(findTrack(byTheWho, "Behind Blue Eyes", limpBizkitSpotifyId), undefined);
});

// A setlist page with the given show dates, for the look-back tests.
function page(dates: string[], lastPage = false): SetlistPageResult {
  return { outcome: "found", shows: dates.map((date) => show(date, "Song")), lastPage };
}

async function lookBackOf(getPage: (page: number) => Promise<SetlistPageResult>, predictionSettings: PredictionSettings): Promise<number> {
  const result = await lookBackShows(getPage, now, predictionSettings);
  assert.ok(!("cause" in result));
  return result.lookBackMonths;
}

test("an artist with fewer than 5 shows in the last 18 months gets a look-back of 3 years, then 5 years", async () => {
  const pages = [
    page(["2026-12-01", "2026-06-01", "2025-01-01"]),
    page(["2024-06-01", "2024-03-01", "2023-06-01"]),
    page(["2023-01-01", "2022-06-01", "2021-06-01", "2020-06-01"]),
    page(["2019-06-01"], true),
  ];
  const requested: number[] = [];
  const getPage = async (number: number) => {
    requested.push(number);
    return pages[number - 1]!;
  };

  // 2 shows in 18 months, 5 shows in 3 years.
  assert.equal(await lookBackOf(getPage, settings), 36);
  assert.deepEqual(requested, [1, 2], "The second page has a show before the 3 years");
  // With 6 shows necessary: 5 in 3 years, 7 in 5 years.
  requested.length = 0;
  assert.equal(await lookBackOf(getPage, { ...settings, fewShows: 6 }), 60);
  assert.deepEqual(requested, [1, 2, 3]);
  // With 9 shows necessary, no period has enough shows. The period is the longest one.
  assert.equal(await lookBackOf(getPage, { ...settings, fewShows: 9 }), 60);
  // The periods are settings.
  assert.equal(await lookBackOf(getPage, { ...settings, fewShows: 6, longLookBackMonths: [24, 48] }), 48);
});

test("an artist with 5 or more shows in the last 18 months gets no long look-back", async (t) => {
  const { prediction, sent } = setUp(t);

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  assert.equal(result.outcome === "predicted" && result.lookBackMonths, 18);
  assert.equal(sent(setlistRequests).filter(({ url }) => url.includes("/artist/")).length, 3, "No more setlist pages");
});

test("the calculation gets the albums of the period, and the 12 months before it", async (t) => {
  const { prediction, sent } = setUp(t);

  await prediction.predict(bringMeTheHorizon.musicbrainzId);

  // The look-back period starts on 19 May 2025, so an album from 19 May 2024 or later can make a show album-focused.
  assert.equal(sent(albumRequests)[0]!.url, musicbrainzAlbumsUrl(bringMeTheHorizon.musicbrainzId, 0));
  assert.equal(sent(albumRequests).length, 4);
});

test("a MusicBrainz failure of the album request stops the calculation with its cause", async (t) => {
  const { prediction, transport } = setUp(t);
  transport.respondTo("GET", musicbrainzAlbumsUrl(bringMeTheHorizon.musicbrainzId, 0), busyResponse);

  const result = await prediction.predict(bringMeTheHorizon.musicbrainzId);

  assert.match(result.outcome === "failed" ? result.cause : "", /MusicBrainz was busy/);
});

const rageAgainstTheMachine = predictedArtists[2]!;

// The predicted songs of Rage Against the Machine, from its 19 shows of 2022 and the
// recorded track searches: Bombtrack, People of the Sun, Bulls on Parade, Bullet in the Head,
// Testify, Guerrilla Radio, Know Your Enemy, Calm Like a Bomb, Sleep Now in the Fire and War Within a Breath.
const rageAgainstTheMachineTracks = [
  "2rBHnIxbhkMGLpqmsNX91M",
  "3QjQp2bfAvLTCSi8Zhzqis",
  "0tZ3mElWcr74OOhKEiNz1x",
  "1WWgMk8nD79p8VeKFGYrOw",
  "7lmeHLHBe4nmXzuXc0HDjk",
  "1wsRitfRRtWyEapl0q22o8",
  "1XTGyfJeMiZXrZ1W3NolcB",
  "1hR0fIFK2qRG3f3RF70pb7",
  "1MQTmpYOZ6fcMQc56Hdo7T",
  "3Hxu3Ey1TV9mZ5XqMXckiS",
];

test("the recorded shows of Rage Against the Machine: no shows in 3 years, so the songs come from the last 5 years", async (t) => {
  const { prediction, sent } = setUp(t);

  const result = await prediction.predict(rageAgainstTheMachine.musicbrainzId);

  assert.deepEqual(result, { outcome: "predicted", trackIds: rageAgainstTheMachineTracks, fallback: false, lookBackMonths: 60 });
  // Page 1 has shows from 2011, so it covers the 5 years.
  assert.deepEqual(
    sent(setlistRequests).filter(({ url }) => url.includes("/artist/")).map(({ url }) => url),
    [setlistFmSetlistsUrl(rageAgainstTheMachine.musicbrainzId, 1)],
  );
  // The cover "The Ghost of Tom Joad" is the 11th song, so it is not in the top 10 songs and gets no search.
  assert.equal(sent(trackSearches).length, 10);
  assert.ok(!sent(trackSearches).some(({ url }) => url === spotifyTrackSearchUrl(songQuery("The Ghost of Tom Joad", "Rage Against The Machine"))));
});

test("the store keeps the look-back period, and a result from a longer period has the long look-back mark", async (t) => {
  const { queue, database } = setUp(t);

  queue.calculate([rageAgainstTheMachine.musicbrainzId, bringMeTheHorizon.musicbrainzId, ghostJapan.musicbrainzId]);
  await queue.idle();

  const mark = (musicbrainzId: string) => hasLongLookBack(findPredictedSongs(database, musicbrainzId)!, settings);
  assert.equal(findPredictedSongs(database, rageAgainstTheMachine.musicbrainzId)?.lookBackMonths, 60);
  assert.equal(mark(rageAgainstTheMachine.musicbrainzId), true);
  assert.equal(mark(bringMeTheHorizon.musicbrainzId), false);
  assert.equal(mark(ghostJapan.musicbrainzId), false, "A fallback result has the fallback mark, not the long look-back mark");
});
