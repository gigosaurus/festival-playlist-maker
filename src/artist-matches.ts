import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { MusicBrainz, MusicBrainzArtist } from "./musicbrainz.ts";

// Artist matching (issue #1, "Artist matching"). An artist match belongs to the
// lineup name text, not to one festival. The same name on a different festival
// therefore gets the same match, with no action of the admin.

// The key of a lineup name: the text in lowercase, with each run of white space
// as one space. "Bring Me The Horizon" and "Bring Me the Horizon" get the same
// match. "Blink 182" and "blink-182" do not, because a different text can be a
// different artist.
export function nameKey(name: string): string {
  return name.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

export type ArtistMatch =
  | { kind: "artist"; artist: MusicBrainzArtist; matchedAt: Date }
  | { kind: "no-match"; matchedAt: Date };

export type ArtistChoice = { kind: "artist"; artist: MusicBrainzArtist } | { kind: "no-match" };

// The choice that the application proposes for a lineup name. Undefined when no
// possible artist is sufficiently probable.
export type Proposal = { kind: "artist"; id: string } | { kind: "no-match" } | undefined;

export interface StoredSearch {
  text: string;
  artists: MusicBrainzArtist[];
  searchedAt: Date;
}

export interface LineupNameMatch {
  lineupNameId: number;
  name: string;
  match?: ArtistMatch;
  // The search for the lineup name, when it is complete.
  search?: StoredSearch;
}

// Each name on the current lineup of a festival, with its artist match and its search.
export function festivalArtistMatches(database: Database, festivalId: number): LineupNameMatch[] {
  const names = database
    .prepare(
      `SELECT lineup_name.id, lineup_name.name
       FROM lineup_name JOIN festival ON festival.id = lineup_name.festival_id
       WHERE festival.id = ? AND lineup_name.last_seen = festival.lineup_updated_at
       ORDER BY lineup_name.name COLLATE NOCASE, lineup_name.name`,
    )
    .all(festivalId) as { id: number; name: string }[];
  return names.map(({ id, name }) => withMatch(database, id, name));
}

// One name on the current lineup of a festival.
export function festivalLineupName(database: Database, festivalId: number, lineupNameId: number): LineupNameMatch | undefined {
  const row = database
    .prepare(
      `SELECT lineup_name.id, lineup_name.name
       FROM lineup_name JOIN festival ON festival.id = lineup_name.festival_id
       WHERE festival.id = ? AND lineup_name.id = ? AND lineup_name.last_seen = festival.lineup_updated_at`,
    )
    .get(festivalId, lineupNameId) as { id: number; name: string } | undefined;
  return row === undefined ? undefined : withMatch(database, row.id, row.name);
}

function withMatch(database: Database, lineupNameId: number, name: string): LineupNameMatch {
  const result: LineupNameMatch = { lineupNameId, name };
  const match = findArtistMatch(database, name);
  const search = storedSearch(database, name);
  if (match !== undefined) result.match = match;
  if (search !== undefined) result.search = search;
  return result;
}

export function findArtistMatch(database: Database, name: string): ArtistMatch | undefined {
  const row = database.prepare("SELECT musicbrainz_id, artist, matched_at FROM artist_match WHERE name_key = ?").get(nameKey(name)) as
    | { musicbrainz_id: string | null; artist: string | null; matched_at: string }
    | undefined;
  if (row === undefined) return undefined;
  const matchedAt = new Date(row.matched_at);
  if (row.musicbrainz_id === null || row.artist === null) return { kind: "no-match", matchedAt };
  return { kind: "artist", artist: JSON.parse(row.artist) as MusicBrainzArtist, matchedAt };
}

// Saves or replaces the artist match of a lineup name text.
export function saveArtistMatch(database: Database, clock: Clock, name: string, choice: ArtistChoice): void {
  database
    .prepare(
      `INSERT INTO artist_match (name_key, musicbrainz_id, artist, matched_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (name_key) DO UPDATE
       SET musicbrainz_id = excluded.musicbrainz_id, artist = excluded.artist, matched_at = excluded.matched_at`,
    )
    .run(
      nameKey(name),
      choice.kind === "artist" ? choice.artist.id : null,
      choice.kind === "artist" ? JSON.stringify(choice.artist) : null,
      clock.now().toISOString(),
    );
}

export function storedSearch(database: Database, text: string): StoredSearch | undefined {
  const row = database.prepare("SELECT artists, searched_at FROM musicbrainz_search WHERE search_key = ?").get(nameKey(text)) as
    | { artists: string; searched_at: string }
    | undefined;
  if (row === undefined) return undefined;
  return { text, artists: JSON.parse(row.artists) as MusicBrainzArtist[], searchedAt: new Date(row.searched_at) };
}

export function storeSearch(database: Database, clock: Clock, text: string, artists: MusicBrainzArtist[]): StoredSearch {
  const searchedAt = clock.now();
  database
    .prepare(
      `INSERT INTO musicbrainz_search (search_key, artists, searched_at) VALUES (?, ?, ?)
       ON CONFLICT (search_key) DO UPDATE SET artists = excluded.artists, searched_at = excluded.searched_at`,
    )
    .run(nameKey(text), JSON.stringify(artists), searchedAt.toISOString());
  return { text, artists, searchedAt };
}

// Lineup names that are not one artist: placeholders such as "???" or
// "Special guest TBA", and more than one artist such as "X b2b Y".
const notOneArtist = /^[^\p{L}\p{N}]*$|\b(tba|tbc|tbd|to be announced|to be confirmed|special guests?|secret (set|guest|act))\b|\sb2b\s/iu;

// The most probable choice for a lineup name:
// 1. "No match" for a name that is not one artist, or when the search found no artist.
// 2. Else, of the artists with the same name (or an alias with the same name):
//    the artists with an expected genre first, then the artist with the most
//    tag votes, then the highest search score.
// 3. Else, no proposal. The admin chooses.
export function proposeArtist(name: string, artists: MusicBrainzArtist[], expectedGenres: string[]): Proposal {
  if (notOneArtist.test(name) || artists.length === 0) return { kind: "no-match" };
  const target = comparableName(name);
  const sameName = artists.filter(
    (artist) => comparableName(artist.name) === target || artist.aliases.some((alias) => comparableName(alias) === target),
  );
  const hasExpectedGenre = (artist: MusicBrainzArtist) => checkGenres(artist, expectedGenres).outcome === "agrees";
  const [best] = sameName.sort(
    (a, b) => Number(hasExpectedGenre(b)) - Number(hasExpectedGenre(a)) || b.votes - a.votes || b.score - a.score,
  );
  return best === undefined ? undefined : { kind: "artist", id: best.id };
}

export type GenreCheck =
  // The genres of the artist that agree with an expected genre.
  | { outcome: "agrees"; genres: string[] }
  | { outcome: "no-genres" }
  | { outcome: "no-expected-genre" };

// An artist genre agrees with an expected genre when it is the same, or when it
// contains the expected genre as whole words: "heavy metal" agrees with "metal",
// but "metalcore" does not. Case, hyphens and accents do not change the result.
export function checkGenres(artist: MusicBrainzArtist, expectedGenres: string[]): GenreCheck {
  if (artist.genres.length === 0) return { outcome: "no-genres" };
  const expected = expectedGenres.map((genre) => ` ${comparableName(genre)} `);
  const genres = artist.genres.filter((genre) => expected.some((each) => ` ${comparableName(genre)} `.includes(each)));
  return genres.length > 0 ? { outcome: "agrees", genres } : { outcome: "no-expected-genre" };
}

// Lowercase, without accents, with "&" as "and" and each run of other characters as one space.
function comparableName(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface SearchQueueState {
  // True while the queue sends searches.
  running: boolean;
  // The cause of the failure that stopped the last run.
  problem?: { cause: string; at: Date };
}

export interface ArtistSearchQueue {
  // Searches MusicBrainz for each name on the current lineup of the festival
  // that has no artist match and no stored search. It does not wait for the searches.
  searchFestival(festivalId: number): void;
  state(): SearchQueueState;
  // Resolves when the queue has no more searches to send. For tests.
  idle(): Promise<void>;
}

// Sends the searches one at a time, in the background. The HTTP client keeps
// the limit of 1 MusicBrainz request each second, so 150 names take approximately
// 3 minutes. The first failure stops the run, because the next searches
// probably fail for the same cause. The admin starts a new run.
export function createArtistSearchQueue(database: Database, musicBrainz: MusicBrainz, clock: Clock): ArtistSearchQueue {
  const waiting = new Map<string, string>();
  let run: Promise<void> | undefined;
  let problem: SearchQueueState["problem"];

  async function sendSearches(): Promise<void> {
    for (const [key, name] of waiting) {
      waiting.delete(key);
      if (findArtistMatch(database, name) !== undefined || storedSearch(database, name) !== undefined) continue;
      const result = await musicBrainz.searchArtists(name);
      if (result.outcome === "failed") {
        problem = { cause: result.cause, at: clock.now() };
        waiting.clear();
        return;
      }
      storeSearch(database, clock, name, result.artists);
    }
  }

  return {
    searchFestival(festivalId) {
      problem = undefined;
      for (const { name, match, search } of festivalArtistMatches(database, festivalId)) {
        if (match === undefined && search === undefined) waiting.set(nameKey(name), name);
      }
      if (run !== undefined || waiting.size === 0) return;
      run = sendSearches()
        .catch((error: unknown) => {
          problem = { cause: `The search stopped because of an error in the application: ${String(error)}`, at: clock.now() };
          waiting.clear();
          console.error("The MusicBrainz search queue stopped.", error);
        })
        .finally(() => {
          run = undefined;
        });
    },

    state() {
      return problem === undefined ? { running: run !== undefined } : { running: run !== undefined, problem };
    },

    async idle() {
      while (run !== undefined) await run;
    },
  };
}
