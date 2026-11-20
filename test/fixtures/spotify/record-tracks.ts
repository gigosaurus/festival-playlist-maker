// Records the Spotify track searches for the predicted song tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/spotify/record-tracks.ts [--new] <database file> <output directory>
// The script calculates the predicted songs of each artist in `predictedArtists`
// (test/support/spotify.ts) with the recorded setlist.fm responses, at the time
// of the setlist.fm recording. It records each Spotify search that the
// calculation sends. It gets an access token with the refresh token of the admin
// in the database file. When Spotify gives a new refresh token, the script writes
// it to the database file. The script reads SPOTIFY_CLIENT_ID and
// ADMIN_SPOTIFY_USER_ID. It waits 2 seconds between requests.
// Then it records the searches in `coverSearches` (test/support/spotify.ts).
// With --new, the script records only the searches that have no file. It uses the
// recorded file for the other searches, so that the recorded responses do not change.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../../../src/database.ts";
import { createSongPrediction } from "../../../src/predicted-songs.ts";
import { createMusicBrainz } from "../../../src/musicbrainz.ts";
import { createSetlistFm } from "../../../src/setlist-fm.ts";
import { defaultPredictionSettings } from "../../../src/settings.ts";
import { setSpotifyArtistByHand } from "../../../src/spotify-artists.ts";
import { songQuery, spotifyArtistUrl, spotifyTrackSearchUrl, type Spotify } from "../../../src/spotify.ts";
import { spotifyTokenUrl } from "../../../src/spotify-log-in.ts";
import { FakeHttpClient } from "../../support/fake-http-client.ts";
import { respondWithRecordedMusicBrainz } from "../../support/musicbrainz.ts";
import { respondWithRecordedSetlistFm, setlistFmRecordedAt } from "../../support/setlist-fm.ts";
import { coverSearches, predictedArtists, trackSearchFileName } from "../../support/spotify.ts";

const onlyNew = process.argv[2] === "--new";
const [databasePath, output] = process.argv.slice(onlyNew ? 3 : 2);
const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
const adminId = process.env.ADMIN_SPOTIFY_USER_ID?.trim();
if (databasePath === undefined || output === undefined || !clientId || !adminId) {
  console.error("Usage: node --env-file=.env test/fixtures/spotify/record-tracks.ts [--new] <database file> <output directory>");
  process.exit(1);
}

const source = new DatabaseSync(databasePath);
const admin = source.prepare("SELECT id, refresh_token FROM user WHERE spotify_user_id = ?").get(adminId) as
  | { id: number; refresh_token: string }
  | undefined;
if (admin === undefined) {
  console.error("The database has no admin. Log in to the application as the admin first.");
  process.exit(1);
}
const tokenResponse = await fetch(spotifyTokenUrl, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: admin.refresh_token, client_id: clientId }),
});
const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
if (!tokenResponse.ok || tokens.access_token === undefined) {
  console.error(`The token request got status ${tokenResponse.status}.`);
  process.exit(1);
}
if (tokens.refresh_token !== undefined) {
  source.prepare("UPDATE user SET refresh_token = ? WHERE id = ?").run(tokens.refresh_token, admin.id);
}
source.close();

// Only the track search is necessary. Each response is written to a file, and
// track-searches.json gets the list of queries.
const queries: string[] = [];
const spotify = {
  async searchTracks(query: string) {
    queries.push(query);
    const file = trackSearchFileName(query);
    let body: string;
    if (onlyNew && existsSync(join(output, file))) {
      body = readFileSync(join(output, file), "utf8");
    } else {
      const response = await fetch(spotifyTrackSearchUrl(query), { headers: { authorization: `Bearer ${tokens.access_token}` } });
      body = await response.text();
      console.log(`${file}: status ${response.status}${response.ok ? "" : ` ${body.slice(0, 300)}`}`);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      if (!response.ok) return { outcome: "failed", cause: `Status ${response.status}` } as const;
      writeFileSync(join(output, file), `${JSON.stringify(JSON.parse(body), null, 1)}\n`);
    }
    const items = (JSON.parse(body) as { tracks: { items: { id: string; name: string; artists: { id: string }[] }[] } }).tracks.items;
    return {
      outcome: "found",
      tracks: items.map((item) => ({ id: item.id, name: item.name, artistIds: item.artists.map((artist) => artist.id) })),
    } as const;
  },
} as Spotify;

// The calculation reads the Spotify artist from a database, so the script uses a temporary one.
// The setlist.fm and MusicBrainz responses are the recorded responses.
const directory = mkdtempSync(join(tmpdir(), "record-tracks-"));
const database = openDatabase(join(directory, "record.sqlite"));
const setlistTransport = new FakeHttpClient();
respondWithRecordedSetlistFm(setlistTransport.respondTo.bind(setlistTransport));
respondWithRecordedMusicBrainz(setlistTransport.respondTo.bind(setlistTransport));
const clock = { now: () => new Date(setlistFmRecordedAt), sleep: async () => undefined };
// The queries contain the Spotify name of the artist. The script uses the name that Spotify gives,
// and shows a difference, so that `predictedArtists` can get the correct name.
for (const { musicbrainzId, spotifyArtist } of predictedArtists) {
  const response = await fetch(spotifyArtistUrl(spotifyArtist.id), { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const name = response.ok ? ((await response.json()) as { name: string }).name : spotifyArtist.name;
  if (name !== spotifyArtist.name) console.log(`The Spotify name of ${spotifyArtist.id} is "${name}", not "${spotifyArtist.name}". Change predictedArtists.`);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  setSpotifyArtistByHand(database, clock, musicbrainzId, { id: spotifyArtist.id, name });
}
const prediction = createSongPrediction({
  database,
  setlistFm: createSetlistFm(setlistTransport),
  musicBrainz: createMusicBrainz(setlistTransport),
  spotify,
  clock,
  settings: defaultPredictionSettings,
});
for (const { musicbrainzId, spotifyArtist } of predictedArtists) {
  console.log(`${spotifyArtist.name}: ${JSON.stringify(await prediction.predict(musicbrainzId))}`);
}
for (const { song, artist } of coverSearches) await spotify.searchTracks(songQuery(song, artist));
writeFileSync(join(output, "track-searches.json"), `${JSON.stringify(queries, null, 1)}\n`);
database.close();
rmSync(directory, { recursive: true, force: true });
