import { comparableName } from "./artist-matches.ts";
import { createBackgroundQueue, type QueueState } from "./background-queue.ts";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { Album, FestivalDays, MusicBrainz } from "./musicbrainz.ts";
import type { PredictionSettings } from "./settings.ts";
import type { SetlistFm, SetlistPageResult, Show } from "./setlist-fm.ts";
import { findSpotifyArtist } from "./spotify-artists.ts";
import { artistTracksQuery, songQuery, type Spotify, type SpotifyArtist, type SpotifyTrack } from "./spotify.ts";

// Predicted songs (issues #12, #13 and #14, ADR-0002): the songs that an artist will
// probably play at a festival, from recent setlists on setlist.fm. Each song is a Spotify
// track of the Spotify artist of the MusicBrainz artist.

export interface PredictedSongs {
  // Spotify track IDs, in order of score.
  trackIds: string[];
  // True when the artist has no setlists in the look-back period, and the
  // tracks come from a Spotify search for the artist.
  fallback: boolean;
  // The look-back period of the calculation, in months. A fallback result has the longest period.
  lookBackMonths: number;
  calculatedAt: Date;
  // The setlist.fm page of the artist, for the attribution link on the Festival page (#18).
  // A fallback result has none. A result from before #18 has none.
  setlistFmAddress?: string;
}

// The store keeps only the Spotify track IDs, the marks, the calculation time and the
// address of the setlist.fm page of the artist. It keeps no setlists, because the
// setlist.fm terms do not permit it (ADR-0002).
export function findPredictedSongs(database: Database, musicbrainzId: string): PredictedSongs | undefined {
  const row = database
    .prepare("SELECT track_ids, fallback, look_back_months, calculated_at, setlist_fm_address FROM predicted_songs WHERE musicbrainz_id = ?")
    .get(musicbrainzId) as
    | { track_ids: string; fallback: number; look_back_months: number; calculated_at: string; setlist_fm_address: string | null }
    | undefined;
  if (row === undefined) return undefined;
  return {
    trackIds: JSON.parse(row.track_ids) as string[],
    fallback: row.fallback === 1,
    lookBackMonths: row.look_back_months,
    calculatedAt: new Date(row.calculated_at),
    ...(row.setlist_fm_address === null ? {} : { setlistFmAddress: row.setlist_fm_address }),
  };
}

export function savePredictedSongs(database: Database, musicbrainzId: string, songs: PredictedSongs): void {
  database
    .prepare(
      `INSERT INTO predicted_songs (musicbrainz_id, track_ids, fallback, look_back_months, calculated_at, setlist_fm_address)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (musicbrainz_id) DO UPDATE
       SET track_ids = excluded.track_ids, fallback = excluded.fallback, look_back_months = excluded.look_back_months,
           calculated_at = excluded.calculated_at, setlist_fm_address = excluded.setlist_fm_address`,
    )
    .run(
      musicbrainzId,
      JSON.stringify(songs.trackIds),
      songs.fallback ? 1 : 0,
      songs.lookBackMonths,
      songs.calculatedAt.toISOString(),
      songs.setlistFmAddress ?? null,
    );
}

// The long look-back mark (#14): the artist had fewer than `fewShows` shows in the
// usual look-back period, so the songs come from a longer period and are less reliable.
export function hasLongLookBack(songs: PredictedSongs, settings: PredictionSettings): boolean {
  return !songs.fallback && songs.lookBackMonths > settings.lookBackMonths;
}

// The look-back periods in months, from the shortest to the longest.
export function lookBackPeriods(settings: PredictionSettings): number[] {
  return [settings.lookBackMonths, ...settings.longLookBackMonths];
}

// The longest look-back period. An artist with no shows in it gets the Spotify search fallback.
export function longestLookBack(settings: PredictionSettings): number {
  return Math.max(...lookBackPeriods(settings));
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
  // True when setlist.fm marks the song as a cover in one or more of its shows.
  cover: boolean;
}

const dayMilliseconds = 24 * 60 * 60 * 1000;

// The average length of a month, for the age of a show.
const monthMilliseconds = (365.25 / 12) * 24 * 60 * 60 * 1000;

// The start of the look-back period.
export function lookBackStart(now: Date, settings: PredictionSettings): Date {
  return addMonths(now, -settings.lookBackMonths);
}

// A show with the result of its venue-and-date check and of the album-focused rule.
export interface CheckedShow extends Show {
  festivalSet: boolean;
  albumFocused: boolean;
}

// True when the show is in the look-back period and has a song that is not a tape.
// Only these shows count, so only these shows need a venue-and-date check.
export function countsForScore(show: Show, now: Date, settings: PredictionSettings): boolean {
  return show.date >= lookBackStart(now, settings) && show.date <= now && show.songs.some((song) => !song.tape && comparableName(song.name) !== "");
}

// True when more than `albumFocusedShare` of the songs of the show come from one
// album that was released in the `albumFocusedMonths` months before the show (#14).
// Tape songs are not songs of the show.
export function isAlbumFocused(show: Show, albums: Album[], settings: PredictionSettings): boolean {
  const songs = new Set(show.songs.filter((song) => !song.tape).map((song) => comparableName(song.name)));
  songs.delete("");
  if (songs.size === 0) return false;
  const day = isoDate(show.date);
  const earliest = isoDate(addMonths(show.date, -settings.albumFocusedMonths));
  return albums.some((album) => {
    if (album.released > day || album.released < earliest) return false;
    const albumSongs = new Set(album.songs.map(comparableName));
    const fromAlbum = [...songs].filter((song) => albumSongs.has(song)).length;
    return fromAlbum > songs.size * settings.albumFocusedShare;
  });
}

// The weight of each show. The weight halves for each `halfLifeMonths` of age.
// An album-focused show counts `albumFocusedWeight`, so that a new album does not fill the playlist.
// A festival set counts `festivalSetWeight`. All the other shows of one tour
// together count a maximum of `tourShowLimit` shows: when a tour has more shows,
// the weight of each of its shows is multiplied by the limit divided by the number of shows.
// Festival sets are not in the tour limit, because setlist.fm often gives a tour
// name to the festival sets of a summer. A show that does not count has weight 0.
export function showWeights(shows: CheckedShow[], now: Date, settings: PredictionSettings): number[] {
  const counts = shows.map((show) => countsForScore(show, now, settings));
  const tourShows = new Map<string, number>();
  shows.forEach((show, index) => {
    if (counts[index] && !show.festivalSet && show.tour !== undefined) tourShows.set(show.tour, (tourShows.get(show.tour) ?? 0) + 1);
  });
  return shows.map((show, index) => {
    if (!counts[index]) return 0;
    const age =
      0.5 ** ((now.getTime() - show.date.getTime()) / monthMilliseconds / settings.halfLifeMonths) *
      (show.albumFocused ? settings.albumFocusedWeight : 1);
    if (show.festivalSet) return age * settings.festivalSetWeight;
    const inTour = show.tour === undefined ? 0 : tourShows.get(show.tour)!;
    return inTour > settings.tourShowLimit ? (age * settings.tourShowLimit) / inTour : age;
  });
}

// Gives each song a score: the sum of the weights of the shows where the artist
// played it (showWeights). Only the shows in the look-back period count. Tape
// songs are not songs of the artist.
// Songs with the same score are in the order in which they first occur in `shows`.
export function scoreSongs(shows: CheckedShow[], now: Date, settings: PredictionSettings): ScoredSong[] {
  const weights = showWeights(shows, now, settings);
  const songs = new Map<string, ScoredSong>();
  shows.forEach((show, index) => {
    const weight = weights[index]!;
    if (weight === 0) return;
    const played = new Set<string>();
    for (const song of show.songs) {
      const key = comparableName(song.name);
      if (song.tape || key === "" || played.has(key)) continue;
      played.add(key);
      const scored = songs.get(key) ?? { name: song.name, score: 0, cover: false };
      scored.score += weight;
      scored.cover ||= song.cover;
      songs.set(key, scored);
    }
  });
  // Array.prototype.sort is stable, so the first occurrence decides between equal scores.
  return [...songs.values()].sort((a, b) => b.score - a.score);
}

// The stored result of a venue-and-date check (#13). The store keeps only the
// venue ID, the date and the result, not the setlists (ADR-0002).
export interface VenueDate {
  festivalSet: boolean;
  checkedAt: Date;
}

export function findVenueDate(database: Database, venueId: string, date: Date): VenueDate | undefined {
  const row = database.prepare("SELECT festival_set, checked_at FROM venue_date WHERE venue_id = ? AND date = ?").get(venueId, isoDate(date)) as
    | { festival_set: number; checked_at: string }
    | undefined;
  if (row === undefined) return undefined;
  return { festivalSet: row.festival_set === 1, checkedAt: new Date(row.checked_at) };
}

export function saveVenueDate(database: Database, venueId: string, date: Date, result: VenueDate): void {
  database
    .prepare(
      `INSERT INTO venue_date (venue_id, date, festival_set, checked_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (venue_id, date) DO UPDATE SET festival_set = excluded.festival_set, checked_at = excluded.checked_at`,
    )
    .run(venueId, isoDate(date), result.festivalSet ? 1 : 0, result.checkedAt.toISOString());
}

// True when the stored result is final. A festival set stays a festival set,
// because setlist.fm users add setlists but seldom remove them. A result "not a
// festival set" is final only when it was checked `festivalSetCheckDays` or more
// after the date, because users add setlists after a show.
export function isFinal(stored: VenueDate, date: Date, settings: PredictionSettings): boolean {
  return stored.festivalSet || stored.checkedAt.getTime() - date.getTime() >= settings.festivalSetCheckDays * dayMilliseconds;
}

// The songs to find on Spotify, in order of score. A cover is kept only when it is
// one of the `coverTopSongs` songs with the highest score (#14), because an artist
// plays some covers only sometimes. The Spotify search then keeps a cover only when
// Spotify has a recording of it by the performing artist (findTrack).
export function songsToFind(songs: ScoredSong[], settings: PredictionSettings): ScoredSong[] {
  return songs.filter((song, rank) => !song.cover || rank < settings.coverTopSongs).slice(0, settings.spotifySearches);
}

// Gets the setlist pages of an artist, the most recent first, until they cover the
// look-back period (#14). When the artist has fewer than `fewShows` shows that count in the
// period, it gets more pages for the next longer period. The result has the shows
// and the period. When no period has enough shows, the period is the longest one.
// A page has the most recent setlists first, so a page with a show before the
// period is the last page necessary for that period.
export async function lookBackShows(
  getPage: (page: number) => Promise<SetlistPageResult>,
  now: Date,
  settings: PredictionSettings,
): Promise<{ shows: Show[]; lookBackMonths: number; artistAddress?: string } | { cause: string }> {
  const shows: Show[] = [];
  let artistAddress: string | undefined;
  let page = 0;
  let complete = false;
  const periods = lookBackPeriods(settings);
  for (const months of periods) {
    const period = { ...settings, lookBackMonths: months };
    const start = lookBackStart(now, period);
    while (!complete && page < settings.setlistPages && !shows.some((show) => show.date < start)) {
      page++;
      const result = await getPage(page);
      if (result.outcome === "no-setlists") {
        complete = true;
        break;
      }
      if (result.outcome === "failed") return { cause: result.cause };
      shows.push(...result.shows);
      artistAddress ??= result.artistAddress;
      complete = result.lastPage;
    }
    if (shows.filter((show) => countsForScore(show, now, period)).length >= settings.fewShows) {
      return { shows, lookBackMonths: months, ...(artistAddress === undefined ? {} : { artistAddress }) };
    }
  }
  return { shows, lookBackMonths: periods.at(-1)!, ...(artistAddress === undefined ? {} : { artistAddress }) };
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
  // `setlistFmAddress`: the setlist.fm page of the artist. A fallback result has none.
  | { outcome: "predicted"; trackIds: string[]; fallback: boolean; lookBackMonths: number; setlistFmAddress?: string }
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
  musicBrainz: Pick<MusicBrainz, "festivalDays" | "albums">;
  spotify: Spotify;
  clock: Clock;
  settings: PredictionSettings;
  // Called with the end of a wait for a rate limit, and with undefined after the wait.
  onWait?: (until: Date | undefined) => void;
}

// The shortest wait after a rate limit, so that a service that gives no wait does not get a request immediately.
const shortestWait = 1_000;

export function createSongPrediction({ database, setlistFm, musicBrainz, spotify, clock, settings, onWait }: PredictionDependencies): SongPrediction {
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

  // Marks each show that counts as a festival set or not (#13). A show is a
  // festival set when its date is in a MusicBrainz festival of the artist, or
  // when setlist.fm has `festivalSetArtists` or more artists at the venue on the date.
  // A festival set from MusicBrainz is stored for its venue and date, so that the
  // other artists at the festival use it. For the other shows, the application
  // uses a final stored result, and sends a setlist.fm request only when there is none.
  // A show without a venue ID and without a MusicBrainz festival is not a festival set.
  // `period` has the look-back period of the calculation.
  async function checkShows(
    shows: Show[],
    now: Date,
    period: PredictionSettings,
    festivals: FestivalDays[],
    albums: Album[],
  ): Promise<CheckedShow[] | { cause: string }> {
    const checked: CheckedShow[] = [];
    for (const show of shows) {
      if (!countsForScore(show, now, period)) {
        checked.push({ ...show, festivalSet: false, albumFocused: false });
        continue;
      }
      const albumFocused = isAlbumFocused(show, albums, period);
      if (inFestival(show.date, festivals)) {
        if (show.venueId !== undefined) saveVenueDate(database, show.venueId, show.date, { festivalSet: true, checkedAt: clock.now() });
        checked.push({ ...show, festivalSet: true, albumFocused });
        continue;
      }
      if (show.venueId === undefined) {
        checked.push({ ...show, festivalSet: false, albumFocused });
        continue;
      }
      const stored = findVenueDate(database, show.venueId, show.date);
      if (stored !== undefined && isFinal(stored, show.date, period)) {
        checked.push({ ...show, festivalSet: stored.festivalSet, albumFocused });
        continue;
      }
      const venueId = show.venueId;
      const result = await patiently(() => setlistFm.venueArtists(venueId, show.date));
      if (result.outcome === "failed") return { cause: result.cause };
      const festivalSet = result.artists >= period.festivalSetArtists;
      saveVenueDate(database, venueId, show.date, { festivalSet, checkedAt: clock.now() });
      checked.push({ ...show, festivalSet, albumFocused });
    }
    return checked;
  }

  // The tracks of the songs, in order of score. A song with no Spotify recording is removed.
  async function tracksOf(songs: ScoredSong[], artist: SpotifyArtist): Promise<string[] | { cause: string }> {
    const trackIds: string[] = [];
    for (const song of songsToFind(songs, settings)) {
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
      const recent = await lookBackShows((page) => patiently(() => setlistFm.artistSetlists(musicbrainzId, page)), now, settings);
      if ("cause" in recent) return { outcome: "failed", cause: recent.cause };
      const { lookBackMonths } = recent;
      const period = { ...settings, lookBackMonths };
      // An artist with no shows in the period gets the fallback, so it needs no MusicBrainz request.
      let festivals: FestivalDays[] = [];
      let albums: Album[] = [];
      if (recent.shows.some((show) => countsForScore(show, now, period))) {
        const festivalResult = await musicBrainz.festivalDays(musicbrainzId);
        if (festivalResult.outcome === "failed") return { outcome: "failed", cause: festivalResult.cause };
        festivals = festivalResult.festivals;
        // An album released before this date cannot make a show in the period album-focused.
        const since = isoDate(addMonths(lookBackStart(now, period), -settings.albumFocusedMonths));
        const albumResult = await musicBrainz.albums(musicbrainzId, since);
        if (albumResult.outcome === "failed") return { outcome: "failed", cause: albumResult.cause };
        albums = albumResult.albums;
      }
      const shows = await checkShows(recent.shows, now, period, festivals, albums);
      if ("cause" in shows) return { outcome: "failed", cause: shows.cause };
      const songs = scoreSongs(shows, now, period);
      if (songs.length > 0) {
        const trackIds = await tracksOf(songs, stored.artist);
        if ("cause" in trackIds) return { outcome: "failed", cause: trackIds.cause };
        if (trackIds.length > 0) {
          const address = recent.artistAddress === undefined ? {} : { setlistFmAddress: recent.artistAddress };
          return { outcome: "predicted", trackIds, fallback: false, lookBackMonths, ...address };
        }
      }
      const trackIds = await searchTracksOf(stored.artist);
      if ("cause" in trackIds) return { outcome: "failed", cause: trackIds.cause };
      return { outcome: "predicted", trackIds, fallback: true, lookBackMonths };
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

// One calculation sends 1 or more setlist.fm requests for the setlists, 1 or more
// MusicBrainz requests for the festivals, 1 or more MusicBrainz requests for the
// albums and 1 more for each album of the period, 1 setlist.fm request for each venue and
// date without a final result and without a MusicBrainz festival, and a maximum of
// `spotifySearches` Spotify requests. With stored venue-and-date results, it takes approximately 10
// to 30 seconds. The first calculation of an artist with many shows takes longer.
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
        savePredictedSongs(database, musicbrainzId, {
          trackIds: result.trackIds,
          fallback: result.fallback,
          lookBackMonths: result.lookBackMonths,
          calculatedAt: clock.now(),
          ...(result.setlistFmAddress === undefined ? {} : { setlistFmAddress: result.setlistFmAddress }),
        });
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

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// True when the date is a day of one of the festivals.
export function inFestival(date: Date, festivals: FestivalDays[]): boolean {
  const day = isoDate(date);
  return festivals.some(({ begin, end }) => begin <= day && day <= end);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
