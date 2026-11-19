import { comparableName } from "./artist-matches.ts";
import { createBackgroundQueue, type QueueState } from "./background-queue.ts";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { PredictionSettings } from "./settings.ts";
import type { SetlistFm, Show } from "./setlist-fm.ts";
import { findSpotifyArtist } from "./spotify-artists.ts";
import { artistTracksQuery, songQuery, type Spotify, type SpotifyArtist, type SpotifyTrack } from "./spotify.ts";

// Predicted songs (issue #12, ADR-0002): the songs that an artist will probably
// play at a festival, from recent setlists on setlist.fm. Each song is a Spotify
// track of the Spotify artist of the MusicBrainz artist.

export interface PredictedSongs {
  // Spotify track IDs, in order of score.
  trackIds: string[];
  // True when the artist has no setlists in the look-back period, and the
  // tracks come from a Spotify search for the artist.
  fallback: boolean;
  calculatedAt: Date;
}

// The store keeps only the Spotify track IDs, the mark and the calculation time.
// It keeps no setlist.fm data, because the setlist.fm terms do not permit it (ADR-0002).
export function findPredictedSongs(database: Database, musicbrainzId: string): PredictedSongs | undefined {
  const row = database.prepare("SELECT track_ids, fallback, calculated_at FROM predicted_songs WHERE musicbrainz_id = ?").get(musicbrainzId) as
    | { track_ids: string; fallback: number; calculated_at: string }
    | undefined;
  if (row === undefined) return undefined;
  return { trackIds: JSON.parse(row.track_ids) as string[], fallback: row.fallback === 1, calculatedAt: new Date(row.calculated_at) };
}

export function savePredictedSongs(database: Database, musicbrainzId: string, songs: PredictedSongs): void {
  database
    .prepare(
      `INSERT INTO predicted_songs (musicbrainz_id, track_ids, fallback, calculated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (musicbrainz_id) DO UPDATE
       SET track_ids = excluded.track_ids, fallback = excluded.fallback, calculated_at = excluded.calculated_at`,
    )
    .run(musicbrainzId, JSON.stringify(songs.trackIds), songs.fallback ? 1 : 0, songs.calculatedAt.toISOString());
}

// The time at which a result stops being valid.
export function validUntil(songs: PredictedSongs, settings: PredictionSettings): Date {
  return addMonths(songs.calculatedAt, settings.validMonths);
}

export function isValid(songs: PredictedSongs, now: Date, settings: PredictionSettings): boolean {
  return now < validUntil(songs, settings);
}

export interface ScoredSong {
  name: string;
  score: number;
}

// The average length of a month, for the age of a show.
const monthMilliseconds = (365.25 / 12) * 24 * 60 * 60 * 1000;

// The start of the look-back period.
export function lookBackStart(now: Date, settings: PredictionSettings): Date {
  return addMonths(now, -settings.lookBackMonths);
}

// Gives each song a score: the sum of the weights of the shows where the artist
// played it. The weight of a show halves for each `halfLifeMonths` of age. Only
// the shows in the look-back period count. Tape songs are not songs of the artist.
// Songs with the same score are in the order in which they first occur in `shows`.
export function scoreSongs(shows: Show[], now: Date, settings: PredictionSettings): ScoredSong[] {
  const start = lookBackStart(now, settings);
  const songs = new Map<string, ScoredSong>();
  for (const show of shows) {
    if (show.date < start || show.date > now) continue;
    const weight = 0.5 ** ((now.getTime() - show.date.getTime()) / monthMilliseconds / settings.halfLifeMonths);
    const played = new Set<string>();
    for (const song of show.songs) {
      const key = comparableName(song.name);
      if (song.tape || key === "" || played.has(key)) continue;
      played.add(key);
      const scored = songs.get(key) ?? { name: song.name, score: 0 };
      scored.score += weight;
      songs.set(key, scored);
    }
  }
  // Array.prototype.sort is stable, so the first occurrence decides between equal scores.
  return [...songs.values()].sort((a, b) => b.score - a.score);
}

// The track of the artist for a song. A track with the same name is first. Then
// a track with the same name after a suffix, for example "Throne - Live" or "Throne (Remastered)".
export function findTrack(tracks: SpotifyTrack[], song: string, artistId: string): SpotifyTrack | undefined {
  const target = comparableName(song);
  const ofArtist = tracks.filter((track) => track.artistIds.includes(artistId));
  return (
    ofArtist.find((track) => comparableName(track.name) === target) ??
    ofArtist.find((track) => comparableName(withoutSuffix(track.name)) === target)
  );
}

function withoutSuffix(name: string): string {
  return name.replace(/\s+-\s+.*$/, "").replace(/\s*[([][^()[\]]*[)\]]\s*$/, "");
}

export type PredictionResult =
  | { outcome: "predicted"; trackIds: string[]; fallback: boolean }
  // The MusicBrainz artist has no Spotify artist, so the application cannot find its tracks.
  | { outcome: "no-spotify-artist" }
  | { outcome: "failed"; cause: string };

export interface SongPrediction {
  // Calculates the predicted songs of a MusicBrainz artist. A rate limit delays
  // the calculation: it waits until the service accepts requests again.
  predict(musicbrainzId: string): Promise<PredictionResult>;
}

export interface PredictionDependencies {
  database: Database;
  setlistFm: SetlistFm;
  spotify: Spotify;
  clock: Clock;
  settings: PredictionSettings;
  // Called with the end of a wait for a rate limit, and with undefined after the wait.
  onWait?: (until: Date | undefined) => void;
}

// The shortest wait after a rate limit, so that a service that gives no wait does not get a request immediately.
const shortestWait = 1_000;

export function createSongPrediction({ database, setlistFm, spotify, clock, settings, onWait }: PredictionDependencies): SongPrediction {
  // Sends a request again after a rate limit, when the service accepts requests again.
  async function patiently<Result extends { outcome: string; retryAt?: Date }>(send: () => Promise<Result>): Promise<Result> {
    for (;;) {
      const result = await send();
      if (result.outcome !== "failed" || result.retryAt === undefined) return result;
      onWait?.(result.retryAt);
      await clock.sleep(Math.max(shortestWait, result.retryAt.getTime() - clock.now().getTime()));
      onWait?.(undefined);
    }
  }

  // The shows in the look-back period. A page has the most recent setlists first,
  // so the application stops at the first page with a show before the period.
  async function recentShows(musicbrainzId: string, start: Date): Promise<Show[] | { cause: string }> {
    const shows: Show[] = [];
    for (let page = 1; page <= settings.setlistPages; page++) {
      const result = await patiently(() => setlistFm.artistSetlists(musicbrainzId, page));
      if (result.outcome === "no-setlists") break;
      if (result.outcome === "failed") return { cause: result.cause };
      shows.push(...result.shows);
      if (result.lastPage || result.shows.some((show) => show.date < start)) break;
    }
    return shows;
  }

  // The tracks of the songs, in order of score. A song with no Spotify recording is removed.
  async function tracksOf(songs: ScoredSong[], artist: SpotifyArtist): Promise<string[] | { cause: string }> {
    const trackIds: string[] = [];
    for (const song of songs.slice(0, settings.spotifySearches)) {
      if (trackIds.length >= settings.songCount) break;
      const result = await patiently(() => spotify.searchTracks(songQuery(song.name, artist.name)));
      if (result.outcome === "failed") return { cause: result.cause };
      const track = findTrack(result.tracks, song.name, artist.id);
      if (track !== undefined && !trackIds.includes(track.id)) trackIds.push(track.id);
    }
    return trackIds;
  }

  // The Spotify search fallback: the tracks of the artist in a search for the
  // artist, one track for each title. Spotify does not document the order.
  async function searchTracksOf(artist: SpotifyArtist): Promise<string[] | { cause: string }> {
    const result = await patiently(() => spotify.searchTracks(artistTracksQuery(artist.name)));
    if (result.outcome === "failed") return { cause: result.cause };
    const titles = new Set<string>();
    const trackIds: string[] = [];
    for (const track of result.tracks) {
      const title = comparableName(withoutSuffix(track.name));
      if (!track.artistIds.includes(artist.id) || titles.has(title)) continue;
      titles.add(title);
      trackIds.push(track.id);
    }
    return trackIds.slice(0, settings.songCount);
  }

  return {
    async predict(musicbrainzId) {
      const stored = findSpotifyArtist(database, musicbrainzId);
      if (stored?.kind !== "found") return { outcome: "no-spotify-artist" };
      const now = clock.now();
      const shows = await recentShows(musicbrainzId, lookBackStart(now, settings));
      if ("cause" in shows) return { outcome: "failed", cause: shows.cause };
      const songs = scoreSongs(shows, now, settings);
      if (songs.length > 0) {
        const trackIds = await tracksOf(songs, stored.artist);
        if ("cause" in trackIds) return { outcome: "failed", cause: trackIds.cause };
        if (trackIds.length > 0) return { outcome: "predicted", trackIds, fallback: false };
      }
      const trackIds = await searchTracksOf(stored.artist);
      if ("cause" in trackIds) return { outcome: "failed", cause: trackIds.cause };
      return { outcome: "predicted", trackIds, fallback: true };
    },
  };
}

export interface PredictionQueueState extends QueueState {
  // The end of the current wait for a rate limit.
  waitingUntil?: Date;
}

export interface PredictedSongQueue {
  // Calculates the predicted songs of each MusicBrainz artist that has a Spotify
  // artist and no valid result. With `again`, it also replaces a valid result.
  // It does not wait for the calculations.
  calculate(musicbrainzIds: Iterable<string>, options?: { again?: boolean }): void;
  state(): PredictionQueueState;
  // True when the artist waits for a calculation, or a calculation of the artist runs.
  isWaiting(musicbrainzId: string): boolean;
  // Resolves when the queue has no more work. For tests.
  idle(): Promise<void>;
}

// One calculation sends 1 or more setlist.fm requests and a maximum of
// `spotifySearches` Spotify requests, so it takes approximately 10 to 30 seconds.
export function createPredictedSongQueue(
  dependencies: Omit<PredictionDependencies, "onWait">,
): PredictedSongQueue {
  const { database, clock, settings } = dependencies;
  let waitingUntil: Date | undefined;
  const waiting = new Set<string>();
  const prediction = createSongPrediction({ ...dependencies, onWait: (until) => (waitingUntil = until) });
  const queue = createBackgroundQueue<{ musicbrainzId: string; again: boolean }>(clock, "predicted songs", async ({ musicbrainzId, again }) => {
    try {
      const stored = findPredictedSongs(database, musicbrainzId);
      if (!again && stored !== undefined && isValid(stored, clock.now(), settings)) return undefined;
      const result = await prediction.predict(musicbrainzId);
      if (result.outcome === "failed") return result.cause;
      if (result.outcome === "predicted") {
        savePredictedSongs(database, musicbrainzId, { trackIds: result.trackIds, fallback: result.fallback, calculatedAt: clock.now() });
      }
      return undefined;
    } finally {
      waiting.delete(musicbrainzId);
    }
  });

  return {
    calculate(musicbrainzIds, options = {}) {
      const items: [string, { musicbrainzId: string; again: boolean }][] = [];
      for (const musicbrainzId of musicbrainzIds) {
        waiting.add(musicbrainzId);
        items.push([musicbrainzId, { musicbrainzId, again: options.again === true }]);
      }
      queue.add(items);
    },
    state() {
      const state = queue.state();
      if (!state.running) waiting.clear();
      return waitingUntil === undefined ? state : { ...state, waitingUntil };
    },
    isWaiting: (musicbrainzId) => waiting.has(musicbrainzId),
    idle: () => queue.idle(),
  };
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
