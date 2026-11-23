import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { PublishedFestival } from "./festivals.ts";
import { festivalLineup, interestLevels, type InterestLevel, type LineupArtist } from "./interest-levels.ts";
import { applicationName } from "./pages/layout.ts";
import { findPredictedSongs } from "./predicted-songs.ts";
import { findSpotifyArtist } from "./spotify-artists.ts";
import type { PlaylistSettings } from "./settings.ts";
import { spotifyPlaylistItemLimit, type SpotifyPlaylists } from "./spotify.ts";

// The playlist builder (#15, #16): makes or updates the playlist of a user for a
// festival. It reads the interest levels of the user and the stored predicted songs.
// It sends no setlist.fm requests. It changes the playlist only when the user starts
// an update.

// One artist on the lineup, with its predicted songs and its Spotify artist.
export interface PlaylistArtist extends LineupArtist {
  // The number of predicted songs.
  predictedSongs: number;
  // The Spotify track IDs of the predicted songs, in order of prediction, for the player (#18).
  trackIds: string[];
  // True when the songs come from the Spotify search fallback, so they are not predicted.
  fallback: boolean;
  // The setlist.fm page of the artist. Only a result from setlists has it.
  setlistFmAddress?: string;
  // The Spotify artist ID, when the artist has a Spotify artist.
  spotifyArtistId?: string;
}

export interface PlannedPlaylist {
  // Each artist on the current lineup, with the number of songs that it gives.
  artists: { lineupNameId: number; songs: number }[];
  // The Spotify track IDs, in the order of the playlist.
  trackIds: string[];
}

// Each artist on the lineup with the interest level of the user, the predicted songs and the Spotify artist.
export function playlistArtists(database: Database, festivalId: number, userId: number): PlaylistArtist[] {
  return festivalLineup(database, festivalId, userId).map((artist) => {
    const songs = findPredictedSongs(database, artist.musicbrainzId);
    const spotify = findSpotifyArtist(database, artist.musicbrainzId);
    return {
      ...artist,
      predictedSongs: songs?.trackIds.length ?? 0,
      trackIds: songs?.trackIds ?? [],
      fallback: songs?.fallback ?? false,
      ...(songs?.setlistFmAddress === undefined || songs.fallback ? {} : { setlistFmAddress: songs.setlistFmAddress }),
      ...(spotify?.kind === "found" ? { spotifyArtistId: spotify.artist.id } : {}),
    };
  });
}

// The songs of the playlist. Each artist gives the number of songs that its interest
// level sets, or fewer when it has fewer predicted songs. The order is Must see, then
// Keen, then Curious; then the artist name in alphabetical order; then the prediction order.
// A track shows only one time, for example when two lineup names have the same artist.
export function planPlaylist(database: Database, festivalId: number, userId: number, settings: PlaylistSettings): PlannedPlaylist {
  const levelOrder = [...interestLevels].reverse();
  // festivalLineup gives the artists in alphabetical order, and the sort keeps that order for each level.
  const artists = festivalLineup(database, festivalId, userId).sort((a, b) => levelOrder.indexOf(a.level) - levelOrder.indexOf(b.level));
  const trackIds: string[] = [];
  const seen = new Set<string>();
  const planned: PlannedPlaylist["artists"] = [];
  for (const artist of artists) {
    const songs = (findPredictedSongs(database, artist.musicbrainzId)?.trackIds ?? []).slice(0, songCount(artist.level, settings));
    const added = songs.filter((id) => !seen.has(id));
    for (const id of added) seen.add(id);
    trackIds.push(...added);
    planned.push({ lineupNameId: artist.lineupNameId, songs: added.length });
  }
  return { artists: planned, trackIds };
}

export function songCount(level: InterestLevel, settings: PlaylistSettings): number {
  return settings.songCounts[level];
}

// "Download 2027".
export function playlistName(festival: PublishedFestival): string {
  return `${festival.name} ${festival.year}`;
}

// The setlist.fm terms require an attribution link. A Spotify description cannot have a link, so it gives the address.
export const playlistDescription = `Made by ${applicationName}. The songs come from setlists on setlist.fm (https://www.setlist.fm).`;

export interface StoredPlaylist {
  spotifyId: string;
  address: string;
  madeAt: Date;
  // The time of the last update that set all of the songs. Undefined before the first one.
  updatedAt?: Date;
  // False when the last attempt changed the songs but did not set all of them.
  complete: boolean;
}

export function findPlaylist(database: Database, userId: number, festivalId: number): StoredPlaylist | undefined {
  const row = database
    .prepare("SELECT spotify_id, address, made_at, updated_at, complete FROM playlist WHERE user_id = ? AND festival_id = ?")
    .get(userId, festivalId) as { spotify_id: string; address: string; made_at: string; updated_at: string | null; complete: number } | undefined;
  if (row === undefined) return undefined;
  return {
    spotifyId: row.spotify_id,
    address: row.address,
    madeAt: new Date(row.made_at),
    ...(row.updated_at === null ? {} : { updatedAt: new Date(row.updated_at) }),
    complete: row.complete === 1,
  };
}

// The IDs of the festivals for which the user has a playlist.
export function festivalsWithPlaylist(database: Database, userId: number): Set<number> {
  const rows = database.prepare("SELECT festival_id FROM playlist WHERE user_id = ?").all(userId) as { festival_id: number }[];
  return new Set(rows.map((row) => row.festival_id));
}

// The lineup names of the artists that an update added to the playlist or removed from it.
export interface PlaylistChanges {
  added: number[];
  removed: number[];
}

// The lineup name IDs of the artists on the lineup at the last complete update. Each
// value is the number of songs that the artist gave. Empty before the first complete update.
export function lineupAtLastUpdate(database: Database, userId: number, festivalId: number): Map<number, number> {
  const rows = database
    .prepare("SELECT lineup_name_id, songs FROM playlist_artist WHERE user_id = ? AND festival_id = ?")
    .all(userId, festivalId) as { lineup_name_id: number; songs: number }[];
  return new Map(rows.map((row) => [row.lineup_name_id, row.songs]));
}

// The changes of the last complete update. Undefined when that update had no earlier
// lineup to compare with, for example the first update.
export function lastChanges(database: Database, userId: number, festivalId: number): PlaylistChanges | undefined {
  const row = database.prepare("SELECT changes FROM playlist WHERE user_id = ? AND festival_id = ?").get(userId, festivalId) as
    | { changes: string | null }
    | undefined;
  return row?.changes ? (JSON.parse(row.changes) as PlaylistChanges) : undefined;
}

// The IDs of the artists on the current lineup that were not on the lineup at the last
// complete update. Empty before the first complete update, because then no artist is new.
export function newArtists(database: Database, userId: number, festivalId: number, lineup: LineupArtist[]): Set<number> {
  const before = lineupAtLastUpdate(database, userId, festivalId);
  if (before.size === 0) return new Set();
  return new Set(lineup.filter((artist) => !before.has(artist.lineupNameId)).map((artist) => artist.lineupNameId));
}

// The changes of an update with the lineup names, in alphabetical order. `onLineup` is
// false for a removed artist that is not an artist on the current lineup.
export interface NamedChanges {
  added: string[];
  removed: { name: string; onLineup: boolean }[];
}

export function nameChanges(database: Database, changes: PlaylistChanges, lineup: LineupArtist[]): NamedChanges {
  const select = database.prepare("SELECT name FROM lineup_name WHERE id = ?");
  const name = (id: number) => (select.get(id) as { name: string } | undefined)?.name;
  const current = new Set(lineup.map((artist) => artist.lineupNameId));
  const byName = (a: string, b: string) => a.localeCompare(b, "en", { sensitivity: "base" });
  return {
    added: changes.added.flatMap((id) => name(id) ?? []).sort(byName),
    removed: changes.removed
      .flatMap((id) => {
        const text = name(id);
        return text === undefined ? [] : [{ name: text, onLineup: current.has(id) }];
      })
      .sort((a, b) => byName(a.name, b.name)),
  };
}

export type BuildResult =
  // `changes`: undefined when there is no earlier complete update to compare with.
  | { outcome: "done"; made: boolean; changes?: PlaylistChanges }
  // `stage`: "not-made" when Spotify did not make the playlist, "not-changed" when the
  // songs of the playlist did not change, "incomplete" when the playlist has only some of the songs.
  | { outcome: "failed"; stage: "not-made" | "not-changed" | "incomplete"; cause: string }
  | { outcome: "empty" }
  | { outcome: "busy" };

export interface PlaylistBuilder {
  // Makes the playlist of the user for the festival, or sets the songs of the playlist that the user has.
  build(festival: PublishedFestival, userId: number): Promise<BuildResult>;
}

export function createPlaylistBuilder({
  database,
  spotify,
  clock,
  settings,
}: {
  database: Database;
  spotify: SpotifyPlaylists;
  clock: Clock;
  settings: PlaylistSettings;
}): PlaylistBuilder {
  // One build at a time for each user and festival. A second build at the same
  // time can make a second Spotify playlist.
  const building = new Set<string>();

  return {
    async build(festival, userId) {
      const key = `${userId}:${festival.id}`;
      if (building.has(key)) return { outcome: "busy" };
      building.add(key);
      try {
        return await build(festival, userId);
      } finally {
        building.delete(key);
      }
    },
  };

  async function build(festival: PublishedFestival, userId: number): Promise<BuildResult> {
    const plan = planPlaylist(database, festival.id, userId, settings);
    if (plan.trackIds.length === 0) return { outcome: "empty" };

    let playlist = findPlaylist(database, userId, festival.id);
    const made = playlist === undefined;
    if (playlist === undefined) {
      const result = await spotify.make(userId, { name: playlistName(festival), description: playlistDescription });
      if (result.outcome === "failed") return { outcome: "failed", stage: "not-made", cause: withRetry(result.cause) };
      const madeAt = clock.now();
      database
        .prepare("INSERT INTO playlist (user_id, festival_id, spotify_id, address, made_at, complete) VALUES (?, ?, ?, ?, ?, 0)")
        .run(userId, festival.id, result.playlist.id, result.playlist.address, madeAt.toISOString());
      playlist = { spotifyId: result.playlist.id, address: result.playlist.address, madeAt, complete: false };
    }

    // The first request replaces all of the items. Each next request adds a maximum of 100 items.
    for (let start = 0; start < plan.trackIds.length; start += spotifyPlaylistItemLimit) {
      const part = plan.trackIds.slice(start, start + spotifyPlaylistItemLimit);
      const result =
        start === 0
          ? await spotify.replaceItems(userId, playlist.spotifyId, part)
          : await spotify.addItems(userId, playlist.spotifyId, part);
      if (result.outcome === "failed") {
        const changed = start > 0;
        if (changed) database.prepare("UPDATE playlist SET complete = 0 WHERE user_id = ? AND festival_id = ?").run(userId, festival.id);
        const stage = changed || !playlist.complete ? "incomplete" : "not-changed";
        return { outcome: "failed", stage, cause: withRetry(result.cause) };
      }
    }
    const changes = saveUpdate(userId, festival.id, plan);
    return { outcome: "done", made, ...(changes ? { changes } : {}) };
  }

  // Records a complete update: the time, the lineup and the changes since the last complete update.
  function saveUpdate(userId: number, festivalId: number, plan: PlannedPlaylist): PlaylistChanges | undefined {
    const before = lineupAtLastUpdate(database, userId, festivalId);
    let changes: PlaylistChanges | undefined;
    if (before.size > 0) {
      const after = new Set(plan.artists.filter((artist) => artist.songs > 0).map((artist) => artist.lineupNameId));
      const earlier = new Set([...before].filter(([, songs]) => songs > 0).map(([id]) => id));
      changes = { added: [...after].filter((id) => !earlier.has(id)), removed: [...earlier].filter((id) => !after.has(id)) };
    }
    const insert = database.prepare("INSERT INTO playlist_artist (user_id, festival_id, lineup_name_id, songs) VALUES (?, ?, ?, ?)");
    database.exec("BEGIN");
    try {
      database
        .prepare("UPDATE playlist SET updated_at = ?, complete = 1, changes = ? WHERE user_id = ? AND festival_id = ?")
        .run(clock.now().toISOString(), changes ? JSON.stringify(changes) : null, userId, festivalId);
      database.prepare("DELETE FROM playlist_artist WHERE user_id = ? AND festival_id = ?").run(userId, festivalId);
      for (const artist of plan.artists) insert.run(userId, festivalId, artist.lineupNameId, artist.songs);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    return changes;
  }
}

// Each failure tells the user to try again. A rate limit gives the time.
function withRetry(cause: string): string {
  return /Try again|log in again/.test(cause) ? cause : `${cause} Try again later.`;
}
