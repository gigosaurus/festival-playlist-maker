import { comparableName } from "./artist-matches.ts";
import { createBackgroundQueue, type QueueState } from "./background-queue.ts";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { MusicBrainz, MusicBrainzArtist } from "./musicbrainz.ts";
import type { Spotify, SpotifyArtist } from "./spotify.ts";

// The Spotify artist of each matched MusicBrainz artist (ADR-0003, user stories
// 63 and 64). The application uses the MusicBrainz Spotify link. When there is
// no link, it uses a Spotify search. The admin can set the Spotify artist by hand.

// "musicbrainz": from the MusicBrainz Spotify link. "search": from a Spotify search.
// "admin": the admin set it by hand.
export type SpotifyArtistSource = "musicbrainz" | "search" | "admin";

export type StoredSpotifyArtist =
  | { kind: "found"; artist: SpotifyArtist; source: SpotifyArtistSource; foundAt: Date }
  // There is no MusicBrainz Spotify link, and the search found no artist with the same name.
  | { kind: "not-found"; foundAt: Date };

export function findSpotifyArtist(database: Database, musicbrainzId: string): StoredSpotifyArtist | undefined {
  const row = database.prepare("SELECT spotify_id, name, source, found_at FROM spotify_artist WHERE musicbrainz_id = ?").get(musicbrainzId) as
    | { spotify_id: string | null; name: string | null; source: SpotifyArtistSource; found_at: string }
    | undefined;
  if (row === undefined) return undefined;
  const foundAt = new Date(row.found_at);
  if (row.spotify_id === null || row.name === null) return { kind: "not-found", foundAt };
  return { kind: "found", artist: { id: row.spotify_id, name: row.name }, source: row.source, foundAt };
}

// Saves the result of a find. It does not replace a Spotify artist that the admin set by hand.
export function saveFoundSpotifyArtist(
  database: Database,
  clock: Clock,
  musicbrainzId: string,
  found: { artist: SpotifyArtist; source: "musicbrainz" | "search" } | undefined,
): void {
  database
    .prepare(
      `INSERT INTO spotify_artist (musicbrainz_id, spotify_id, name, source, found_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (musicbrainz_id) DO UPDATE
       SET spotify_id = excluded.spotify_id, name = excluded.name, source = excluded.source, found_at = excluded.found_at
       WHERE spotify_artist.source <> 'admin'`,
    )
    .run(musicbrainzId, found?.artist.id ?? null, found?.artist.name ?? null, found?.source ?? "search", clock.now().toISOString());
}

export function setSpotifyArtistByHand(database: Database, clock: Clock, musicbrainzId: string, artist: SpotifyArtist): void {
  database
    .prepare(
      `INSERT INTO spotify_artist (musicbrainz_id, spotify_id, name, source, found_at) VALUES (?, ?, ?, 'admin', ?)
       ON CONFLICT (musicbrainz_id) DO UPDATE
       SET spotify_id = excluded.spotify_id, name = excluded.name, source = excluded.source, found_at = excluded.found_at`,
    )
    .run(musicbrainzId, artist.id, artist.name, clock.now().toISOString());
}

export type FindResult =
  | { outcome: "found"; artist: SpotifyArtist; source: "musicbrainz" | "search" }
  | { outcome: "not-found" }
  | { outcome: "failed"; cause: string };

// Finds the Spotify artist of a MusicBrainz artist:
// 1. The first MusicBrainz Spotify link to an artist that Spotify has.
// 2. Else, the first artist in a Spotify search for the name that has the same
//    name or alias. Names are compared without case, accents and punctuation.
//    Spotify gives the most relevant artist first.
export async function findSpotifyArtistFor(musicBrainz: MusicBrainz, spotify: Spotify, artist: MusicBrainzArtist): Promise<FindResult> {
  const links = await musicBrainz.spotifyLinks(artist.id);
  if (links.outcome === "failed") return links;
  for (const id of links.spotifyIds) {
    const result = await spotify.artist(id);
    if (result.outcome === "failed") return result;
    if (result.outcome === "found") return { outcome: "found", artist: result.artist, source: "musicbrainz" };
  }
  const search = await spotify.searchArtists(artist.name);
  if (search.outcome === "failed") return search;
  const names = new Set([artist.name, ...artist.aliases].map(comparableName));
  const same = search.artists.find((each) => names.has(comparableName(each.name)));
  return same === undefined ? { outcome: "not-found" } : { outcome: "found", artist: same, source: "search" };
}

export interface SpotifyArtistQueue {
  // Finds the Spotify artist of each MusicBrainz artist that has none. With
  // `again`, it also finds the Spotify artist again, because the MusicBrainz data
  // can be different. It never replaces a Spotify artist that the admin set by hand.
  find(artists: MusicBrainzArtist[], options?: { again?: boolean }): void;
  state(): QueueState;
  // Resolves when the queue has no more work. For tests.
  idle(): Promise<void>;
}

// Each find sends 2 or 3 requests: the MusicBrainz lookup, and 1 or 2 Spotify requests.
export function createSpotifyArtistQueue(database: Database, musicBrainz: MusicBrainz, spotify: Spotify, clock: Clock): SpotifyArtistQueue {
  const queue = createBackgroundQueue<{ artist: MusicBrainzArtist; again: boolean }>(clock, "Spotify artist", async ({ artist, again }) => {
    const stored = findSpotifyArtist(database, artist.id);
    if (stored?.kind === "found" && stored.source === "admin") return undefined;
    if (stored !== undefined && !again) return undefined;
    const result = await findSpotifyArtistFor(musicBrainz, spotify, artist);
    if (result.outcome === "failed") return result.cause;
    saveFoundSpotifyArtist(database, clock, artist.id, result.outcome === "found" ? result : undefined);
    return undefined;
  });

  return {
    find(artists, options = {}) {
      queue.add(artists.map((artist) => [artist.id, { artist, again: options.again === true }]));
    },
    state: () => queue.state(),
    idle: () => queue.idle(),
  };
}
