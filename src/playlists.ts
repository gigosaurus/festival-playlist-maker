import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { PublishedFestival } from "./festivals.ts";
import { festivalLineup, interestLevels, type InterestLevel, type LineupArtist } from "./interest-levels.ts";
import { applicationName } from "./pages/layout.ts";
import { findPredictedSongs } from "./predicted-songs.ts";
import type { PlaylistSettings } from "./settings.ts";
import { spotifyPlaylistItemLimit, type SpotifyPlaylists } from "./spotify.ts";

// The playlist builder (#15): makes the playlist of a user for a festival. It reads
// the interest levels of the user and the stored predicted songs. It sends no
// setlist.fm requests.

// One artist on the lineup, with the number of predicted songs that it has.
export interface PlaylistArtist extends LineupArtist {
  predictedSongs: number;
}

export interface PlannedPlaylist {
  // The artists that give one or more songs.
  artists: number;
  // The Spotify track IDs, in the order of the playlist.
  trackIds: string[];
}

// Each artist on the lineup with the interest level of the user and the number of predicted songs.
export function playlistArtists(database: Database, festivalId: number, userId: number): PlaylistArtist[] {
  return festivalLineup(database, festivalId, userId).map((artist) => ({
    ...artist,
    predictedSongs: findPredictedSongs(database, artist.musicbrainzId)?.trackIds.length ?? 0,
  }));
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
  let artistCount = 0;
  for (const artist of artists) {
    const songs = (findPredictedSongs(database, artist.musicbrainzId)?.trackIds ?? []).slice(0, songCount(artist.level, settings));
    const added = songs.filter((id) => !seen.has(id));
    for (const id of added) seen.add(id);
    trackIds.push(...added);
    if (added.length > 0) artistCount++;
  }
  return { artists: artistCount, trackIds };
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

export type BuildResult =
  | { outcome: "done"; made: boolean }
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
    database
      .prepare("UPDATE playlist SET updated_at = ?, complete = 1 WHERE user_id = ? AND festival_id = ?")
      .run(clock.now().toISOString(), userId, festival.id);
    return { outcome: "done", made };
  }
}

// Each failure tells the user to try again. A rate limit gives the time.
function withRetry(cause: string): string {
  return /Try again|log in again/.test(cause) ? cause : `${cause} Try again later.`;
}
