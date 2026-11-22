import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { saveArtistMatch } from "../../src/artist-matches.ts";
import { openDatabase } from "../../src/database.ts";
import { addFestival, findPublishedFestival, publishFestival } from "../../src/festivals.ts";
import { spotifyApiOrigin, withServiceRules } from "../../src/http-client.ts";
import { festivalLineup, saveInterestLevels, type InterestLevel } from "../../src/interest-levels.ts";
import { getFestivalLineup } from "../../src/lineups.ts";
import {
  createPlaylistBuilder,
  festivalsWithPlaylist,
  findPlaylist,
  lastChanges,
  nameChanges,
  newArtists,
  planPlaylist,
  playlistDescription,
} from "../../src/playlists.ts";
import { savePredictedSongs } from "../../src/predicted-songs.ts";
import { createSessions } from "../../src/sessions.ts";
import { createSpotifyPlaylists, spotifyMyPlaylistsUrl, spotifyPlaylistItemsUrl } from "../../src/spotify.ts";
import { spotifyTokenUrl } from "../../src/spotify-log-in.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import {
  forbiddenResponse,
  playlistItemsResponse,
  playlistMadeResponse,
  quotaExceededResponse,
  rateLimitResponse,
  testPlaylistId,
} from "../support/spotify.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { spotifyTokenResponse, testSettings } from "../support/test-settings.ts";

// The lineup name ID of "Ghost".
function findGhost(database: ReturnType<typeof openDatabase>): number {
  return (database.prepare("SELECT id FROM lineup_name WHERE name = 'Ghost'").get() as { id: number }).id;
}

// A Spotify track ID (22 characters) for song `song` of the artist.
function trackId(artist: string, song: number): string {
  return `${artist.replace(/[^A-Za-z]/g, "").slice(0, 12)}${song}`.padEnd(22, "x");
}

function tracks(artist: string, count: number): string[] {
  return Array.from({ length: count }, (_, song) => trackId(artist, song));
}

const userSpotifyId = "alex-on-allowlist";

// A published festival "Download 2027" with the artists. Each artist has the number
// of predicted songs in `songs`. The user "alex" is logged in with refresh token "user-refresh-token".
async function setUp(t: TestContext, songs: Record<string, number>) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock();
  const settings = testSettings();
  createSessions(database, clock, settings).logIn({ spotifyUserId: userSpotifyId, displayName: "Alex", refreshToken: "user-refresh-token" });
  const userId = (database.prepare("SELECT id FROM user WHERE spotify_user_id = ?").get(userSpotifyId) as { id: number }).id;

  const added = addFestival(
    database,
    { name: "Download", year: 2027, startDate: "2027-06-11", endDate: "2027-06-13", expectedGenres: [], page: "download27" },
    { source: "clashfinder", page: "download27", pageName: "Download Festival 2027" },
  );
  assert.equal(added.outcome, "added");
  const festivalId = added.outcome === "added" ? added.id : 0;
  // Gets the lineup with the names in `lineupSongs`, and matches each name to an artist with predicted songs.
  async function setLineup(lineupSongs: Record<string, number>) {
    const names = Object.keys(lineupSongs);
    const source = { getLineup: async () => ({ outcome: "got" as const, lineup: { entries: names.map((name) => ({ name })) } }) };
    await getFestivalLineup(database, source, clock, festivalId);
    for (const name of names) {
      const artist = { id: `id-${name}`, name, genres: [], ended: false, score: 100, votes: 1, aliases: [] };
      saveArtistMatch(database, clock, name, { kind: "artist", artist });
      if (lineupSongs[name]! > 0) {
        savePredictedSongs(database, artist.id, { trackIds: tracks(name, lineupSongs[name]!), fallback: false, lookBackMonths: 18, calculatedAt: clock.now() });
      }
    }
  }
  await setLineup(songs);
  assert.equal(publishFestival(database, festivalId).outcome, "published");
  const festival = findPublishedFestival(database, festivalId)!;

  const transport = new FakeHttpClient();
  transport.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse("user-refresh-token-2"));
  transport.respondTo("POST", spotifyMyPlaylistsUrl, playlistMadeResponse("Download 2027", playlistDescription, userSpotifyId));
  transport.respondTo("PUT", spotifyPlaylistItemsUrl(testPlaylistId), playlistItemsResponse(200));
  transport.respondTo("POST", spotifyPlaylistItemsUrl(testPlaylistId), playlistItemsResponse(201));
  const spotify = createSpotifyPlaylists(withServiceRules(transport, settings, clock), database, clock, settings);
  const builder = createPlaylistBuilder({ database, spotify, clock, settings: settings.playlist });

  function setLevels(levels: Record<string, InterestLevel>) {
    const ids = new Map(festivalLineup(database, festivalId, userId).map((artist) => [artist.name, artist.lineupNameId]));
    saveInterestLevels(database, festivalId, userId, new Map(Object.entries(levels).map(([name, level]) => [ids.get(name)!, level])));
  }

  const playlistRequests = () => transport.requests.filter((request) => request.url.startsWith(spotifyApiOrigin));
  const sentUris = (index: number) => (JSON.parse(playlistRequests()[index]!.body!) as { uris: string[] }).uris;

  // The lineup names of the changes of the last complete update, and the new artists.
  function changes() {
    const stored = lastChanges(database, userId, festivalId);
    return stored && nameChanges(database, stored, festivalLineup(database, festivalId, userId));
  }
  function newNames() {
    const lineup = festivalLineup(database, festivalId, userId);
    const ids = newArtists(database, userId, festivalId, lineup);
    return lineup.filter((artist) => ids.has(artist.lineupNameId)).map((artist) => artist.name);
  }

  return { database, clock, transport, builder, festival, userId, setLevels, setLineup, changes, newNames, playlistRequests, sentUris };
}

test("each artist gets the songs of its interest level, or fewer when it has fewer predicted songs", async (t) => {
  const { database, festival, userId, setLevels } = await setUp(t, {
    "Must See Band": 10,
    "Keen Band": 10,
    "Curious Band": 10,
    "Not Interested Band": 10,
    "Short Band": 3,
    "No Songs Band": 0,
  });
  setLevels({ "Must See Band": "must-see", "Keen Band": "keen", "Not Interested Band": "not-interested", "Short Band": "must-see", "No Songs Band": "must-see" });

  const plan = planPlaylist(database, festival.id, userId, testSettings().playlist);

  const count = (artist: string) => plan.trackIds.filter((id) => id.startsWith(artist.replace(/[^A-Za-z]/g, "").slice(0, 12))).length;
  assert.equal(count("Must See Band"), 7);
  assert.equal(count("Keen Band"), 4);
  assert.equal(count("Curious Band"), 2);
  assert.equal(count("Not Interested Band"), 0);
  assert.equal(count("Short Band"), 3);
  assert.equal(plan.trackIds.length, 16);
  // "No Songs Band" and "Not Interested Band" give no songs.
  assert.equal(plan.artists.filter((artist) => artist.songs > 0).length, 4);
  assert.equal(plan.artists.length, 6);
});

test("the songs are in the order Must see, Keen, Curious; then artist name; then prediction order", async (t) => {
  const { database, festival, userId, setLevels } = await setUp(t, {
    Anthrax: 10,
    Biffy: 10,
    "Code Orange": 10,
    Deftones: 10,
    Employed: 10,
  });
  setLevels({ Employed: "must-see", Biffy: "must-see", Anthrax: "keen", Deftones: "curious", "Code Orange": "keen" });

  const { trackIds } = planPlaylist(database, festival.id, userId, testSettings().playlist);

  assert.deepEqual(trackIds, [
    ...tracks("Biffy", 7),
    ...tracks("Employed", 7),
    ...tracks("Anthrax", 4),
    ...tracks("Code Orange", 4),
    ...tracks("Deftones", 2),
  ]);
});

test("the first update makes a private playlist named “Download 2027” in the account of the user, with all of the songs", async (t) => {
  const { database, clock, transport, builder, festival, userId, setLevels, playlistRequests, sentUris } = await setUp(t, {
    Ghost: 10,
    Turnstile: 10,
    Sleep: 10,
  });
  // 7 + 7 + 7 songs, so that two item requests are not necessary: see the next test for more than 100 songs.
  setLevels({ Ghost: "must-see", Turnstile: "must-see", Sleep: "must-see" });

  const result = await builder.build(festival, userId);

  assert.deepEqual(result, { outcome: "done", made: true });
  // The access token comes from the refresh token of the user, not of the admin.
  assert.equal(new URLSearchParams(transport.requests[0]!.body).get("refresh_token"), "user-refresh-token");
  const [make, replace] = playlistRequests();
  assert.equal(make!.method, "POST");
  assert.equal(make!.url, spotifyMyPlaylistsUrl);
  assert.deepEqual(JSON.parse(make!.body!), { name: "Download 2027", description: playlistDescription, public: false });
  assert.match(playlistDescription, /Festival Playlist Maker/);
  assert.match(playlistDescription, /setlist\.fm \(https:\/\/www\.setlist\.fm\)/);
  assert.equal(replace!.method, "PUT");
  assert.equal(replace!.url, spotifyPlaylistItemsUrl(testPlaylistId));
  assert.deepEqual(sentUris(1), [...tracks("Ghost", 7), ...tracks("Sleep", 7), ...tracks("Turnstile", 7)].map((id) => `spotify:track:${id}`));
  assert.equal(playlistRequests().length, 2);
  // The playlist builder sends no setlist.fm requests.
  assert.deepEqual(new Set(transport.requests.map((request) => new URL(request.url).origin)), new Set(["https://accounts.spotify.com", spotifyApiOrigin]));

  // The HTTP client waits 1 second between Spotify requests, so the update is 1 second after the make.
  assert.deepEqual(findPlaylist(database, userId, festival.id), {
    spotifyId: testPlaylistId,
    address: `https://open.spotify.com/playlist/${testPlaylistId}`,
    madeAt: new Date(clock.now().getTime() - 1_000),
    updatedAt: clock.now(),
    complete: true,
  });
  assert.deepEqual(festivalsWithPlaylist(database, userId), new Set([festival.id]));
});

test("more than 100 songs go in requests of a maximum of 100 songs, in order", async (t) => {
  const songs = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`Band ${String.fromCharCode(65 + (index % 26))}${String.fromCharCode(65 + Math.floor(index / 26))}`, 10]));
  const { builder, festival, userId, setLevels, playlistRequests, sentUris } = await setUp(t, songs);
  setLevels(Object.fromEntries(Object.keys(songs).map((name) => [name, "must-see" as const])));

  assert.deepEqual(await builder.build(festival, userId), { outcome: "done", made: true });

  // 30 artists × 7 songs = 210 songs: replace 100, add 100, add 10.
  assert.deepEqual(playlistRequests().map((request) => request.method), ["POST", "PUT", "POST", "POST"]);
  assert.deepEqual([sentUris(1).length, sentUris(2).length, sentUris(3).length], [100, 100, 10]);
  assert.equal(new Set([...sentUris(1), ...sentUris(2), ...sentUris(3)]).size, 210);
});

test("a later update sets the songs of the same playlist and does not make a new playlist", async (t) => {
  const { clock, builder, festival, userId, setLevels, playlistRequests, sentUris, database } = await setUp(t, { Ghost: 10, Sleep: 10 });
  await builder.build(festival, userId);
  clock.advance(60 * 60_000);
  setLevels({ Ghost: "not-interested" });

  assert.deepEqual(await builder.build(festival, userId), { outcome: "done", made: false, changes: { added: [], removed: [findGhost(database)] } });

  assert.deepEqual(playlistRequests().map((request) => request.method), ["POST", "PUT", "PUT"]);
  assert.deepEqual(sentUris(2), tracks("Sleep", 2).map((id) => `spotify:track:${id}`));
  assert.deepEqual(findPlaylist(database, userId, festival.id)?.updatedAt, clock.now());
});

test("a Spotify rate limit when the playlist is made gives the wait, and stores no playlist", async (t) => {
  const { database, transport, builder, festival, userId, playlistRequests } = await setUp(t, { Ghost: 10 });
  transport.respondTo("POST", spotifyMyPlaylistsUrl, rateLimitResponse(120));

  const result = await builder.build(festival, userId);

  assert.deepEqual(result, {
    outcome: "failed",
    stage: "not-made",
    cause: "Spotify limited the requests of the application (status 429). Try again in 2 minutes.",
  });
  assert.equal(playlistRequests().length, 1);
  assert.equal(findPlaylist(database, userId, festival.id), undefined);
  assert.deepEqual(festivalsWithPlaylist(database, userId), new Set());
});

test("a Spotify rate limit after some of the songs marks the playlist as not complete, and the next attempt uses the same playlist", async (t) => {
  const songs = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`Band ${String.fromCharCode(65 + index)}`, 10]));
  const { database, clock, transport, builder, festival, userId, setLevels, playlistRequests } = await setUp(t, songs);
  setLevels(Object.fromEntries(Object.keys(songs).map((name) => [name, "must-see" as const])));
  transport.respondTo("POST", spotifyPlaylistItemsUrl(testPlaylistId), rateLimitResponse(120));

  const result = await builder.build(festival, userId);

  assert.equal(result.outcome, "failed");
  assert.equal(result.outcome === "failed" && result.stage, "incomplete");
  const stored = findPlaylist(database, userId, festival.id);
  assert.equal(stored?.complete, false);
  assert.equal(stored?.updatedAt, undefined);

  clock.advance(3 * 60_000);
  transport.respondTo("POST", spotifyPlaylistItemsUrl(testPlaylistId), playlistItemsResponse(201));
  assert.deepEqual(await builder.build(festival, userId), { outcome: "done", made: false });
  assert.equal(playlistRequests().filter((request) => request.url === spotifyMyPlaylistsUrl).length, 1);
  assert.equal(findPlaylist(database, userId, festival.id)?.complete, true);
});

test("when Spotify refuses the first item request of an update, the playlist did not change", async (t) => {
  const { database, transport, builder, festival, userId } = await setUp(t, { Ghost: 10 });
  await builder.build(festival, userId);
  transport.respondTo("PUT", spotifyPlaylistItemsUrl(testPlaylistId), forbiddenResponse);

  const result = await builder.build(festival, userId);

  assert.deepEqual(result, {
    outcome: "failed",
    stage: "not-changed",
    cause: "Spotify refused the request (status 403): Insufficient client scope. Try again later.",
  });
  assert.equal(findPlaylist(database, userId, festival.id)?.complete, true);
});

test("a Spotify quota error gives the cause", async (t) => {
  const { transport, builder, festival, userId } = await setUp(t, { Ghost: 10 });
  transport.respondTo("POST", spotifyMyPlaylistsUrl, quotaExceededResponse);

  const result = await builder.build(festival, userId);

  assert.equal(result.outcome === "failed" && result.stage, "not-made");
  assert.match(result.outcome === "failed" ? result.cause : "", /QUOTA_EXCEEDED.*Try again later\.$/);
});

test("a playlist without songs is not made", async (t) => {
  const { builder, festival, userId, setLevels, playlistRequests } = await setUp(t, { Ghost: 10, Sleep: 0 });
  setLevels({ Ghost: "not-interested" });

  assert.deepEqual(await builder.build(festival, userId), { outcome: "empty" });
  assert.equal(playlistRequests().length, 0);
});

test("a second build for the same user and festival does not start while the first one runs", async (t) => {
  const { builder, festival, userId, playlistRequests } = await setUp(t, { Ghost: 10 });

  const [first, second] = await Promise.all([builder.build(festival, userId), builder.build(festival, userId)]);

  assert.deepEqual(first, { outcome: "done", made: true });
  assert.deepEqual(second, { outcome: "busy" });
  assert.equal(playlistRequests().filter((request) => request.url === spotifyMyPlaylistsUrl).length, 1);
});

test("a later update after a lineup change uses the current lineup, and gives the added and removed artists", async (t) => {
  const { clock, builder, festival, userId, setLevels, setLineup, changes, newNames, playlistRequests, sentUris } = await setUp(t, {
    Ghost: 10,
    Sleep: 10,
    Turnstile: 10,
  });
  setLevels({ Turnstile: "keen" });
  assert.deepEqual(await builder.build(festival, userId), { outcome: "done", made: true });
  // The first update has no earlier lineup, so it gives no changes and no artist is new.
  assert.equal(changes(), undefined);
  assert.deepEqual(newNames(), []);

  // The admin gets the lineup again: "Sleep" is cancelled, "Anthrax" and "Deftones" are added.
  clock.advance(24 * 60 * 60_000);
  await setLineup({ Anthrax: 10, Deftones: 10, Ghost: 10, Turnstile: 10 });
  // The playlist changes only when the user starts an update.
  assert.equal(playlistRequests().length, 2);
  assert.deepEqual(newNames(), ["Anthrax", "Deftones"]);

  // The user sets the new artists, and removes "Ghost".
  setLevels({ Anthrax: "must-see", Deftones: "not-interested", Ghost: "not-interested" });
  const result = await builder.build(festival, userId);

  const ids = (names: string[]) => names.map((name) => `spotify:track:${name}`);
  assert.equal(result.outcome, "done");
  assert.equal(result.outcome === "done" && result.made, false);
  // The same playlist: one make, then the items of that playlist are replaced.
  assert.deepEqual(playlistRequests().map((request) => `${request.method} ${request.url}`), [
    `POST ${spotifyMyPlaylistsUrl}`,
    `PUT ${spotifyPlaylistItemsUrl(testPlaylistId)}`,
    `PUT ${spotifyPlaylistItemsUrl(testPlaylistId)}`,
  ]);
  // The removed lineup name "Sleep" is not in the playlist.
  assert.deepEqual(sentUris(2), ids([...tracks("Anthrax", 7), ...tracks("Turnstile", 4)]));
  assert.deepEqual(changes(), {
    added: ["Anthrax"],
    removed: [
      { name: "Ghost", onLineup: true },
      { name: "Sleep", onLineup: false },
    ],
  });
  // After the update, no artist is new.
  assert.deepEqual(newNames(), []);
});

test("an update without changes to the artists gives empty changes", async (t) => {
  const { builder, festival, userId, setLevels, changes } = await setUp(t, { Ghost: 10, Sleep: 10 });
  await builder.build(festival, userId);
  // A change of level changes the songs, but not the artists.
  setLevels({ Ghost: "must-see" });

  assert.equal((await builder.build(festival, userId)).outcome, "done");

  assert.deepEqual(changes(), { added: [], removed: [] });
});

test("an update that fails keeps the lineup and the changes of the last complete update", async (t) => {
  const { clock, transport, builder, festival, userId, setLevels, setLineup, changes, newNames } = await setUp(t, { Ghost: 10, Sleep: 10 });
  await builder.build(festival, userId);
  await setLineup({ Ghost: 10, Sleep: 10, Turnstile: 10 });
  transport.respondTo("PUT", spotifyPlaylistItemsUrl(testPlaylistId), rateLimitResponse(120));

  assert.equal((await builder.build(festival, userId)).outcome, "failed");
  assert.equal(changes(), undefined);
  assert.deepEqual(newNames(), ["Turnstile"]);

  // A change of level before the next attempt is also in the changes.
  clock.advance(3 * 60_000);
  setLevels({ Sleep: "not-interested" });
  transport.respondTo("PUT", spotifyPlaylistItemsUrl(testPlaylistId), playlistItemsResponse(200));
  assert.equal((await builder.build(festival, userId)).outcome, "done");
  assert.deepEqual(changes(), { added: ["Turnstile"], removed: [{ name: "Sleep", onLineup: true }] });
});
