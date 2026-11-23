import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Database = DatabaseSync;

// Each migration runs once, in order. The SQLite user_version pragma records
// how many migrations the database file has. Do not change a migration after
// it is released. Add a new migration to the end of the list.
const migrations: readonly string[] = [
  `CREATE TABLE festival (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
    UNIQUE (name, year)
  ) STRICT`,
  // The admin role is not stored. It comes from the configured Spotify user ID.
  `CREATE TABLE user (
    id INTEGER PRIMARY KEY,
    spotify_user_id TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    refresh_token TEXT NOT NULL
  ) STRICT;
  CREATE TABLE session (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL
  ) STRICT;
  CREATE INDEX session_user ON session (user_id);`,
  // The lineup source and the lineup of each festival (#6).
  // lineup_updated_at: the time of the last lineup that the application got.
  // lineup_checked_at and lineup_problem: the time and the cause of failure of the
  // last attempt. lineup_problem is NULL after a successful attempt.
  // A lineup name is on the current lineup when its last_seen is lineup_updated_at.
  `ALTER TABLE festival ADD COLUMN lineup_source TEXT NOT NULL DEFAULT 'clashfinder';
  ALTER TABLE festival ADD COLUMN lineup_source_settings TEXT NOT NULL DEFAULT '{}';
  ALTER TABLE festival ADD COLUMN lineup_timezone TEXT;
  ALTER TABLE festival ADD COLUMN lineup_updated_at TEXT;
  ALTER TABLE festival ADD COLUMN lineup_checked_at TEXT;
  ALTER TABLE festival ADD COLUMN lineup_problem TEXT;
  CREATE TABLE expected_genre (
    festival_id INTEGER NOT NULL REFERENCES festival (id) ON DELETE CASCADE,
    name TEXT NOT NULL COLLATE NOCASE,
    PRIMARY KEY (festival_id, name)
  ) STRICT;
  CREATE TABLE lineup_name (
    id INTEGER PRIMARY KEY,
    festival_id INTEGER NOT NULL REFERENCES festival (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    UNIQUE (festival_id, name)
  ) STRICT;
  -- The day, the stage and the set times of each appearance, for version 2.
  -- start_time and end_time are local times at the festival (festival.lineup_timezone).
  CREATE TABLE lineup_time (
    lineup_name_id INTEGER NOT NULL REFERENCES lineup_name (id) ON DELETE CASCADE,
    day TEXT,
    stage TEXT,
    start_time TEXT,
    end_time TEXT
  ) STRICT;
  CREATE INDEX lineup_time_name ON lineup_time (lineup_name_id);`,
  // Artist matches (#7). A match belongs to the lineup name text, so it has no
  // festival. name_key is the text in lowercase with single spaces (nameKey in
  // artist-matches.ts). musicbrainz_id and artist are NULL for "no match".
  // artist: the MusicBrainz artist as JSON, as the admin saw it at the match.
  // musicbrainz_search: the last search result for each text, as JSON, so that
  // a page shows the possible artists without a new request.
  `CREATE TABLE artist_match (
    name_key TEXT PRIMARY KEY,
    musicbrainz_id TEXT,
    artist TEXT,
    matched_at TEXT NOT NULL,
    CHECK ((musicbrainz_id IS NULL) = (artist IS NULL))
  ) STRICT;
  CREATE TABLE musicbrainz_search (
    search_key TEXT PRIMARY KEY,
    artists TEXT NOT NULL,
    searched_at TEXT NOT NULL
  ) STRICT;`,
  // The Spotify artist of each MusicBrainz artist (#8). It belongs to the
  // MusicBrainz artist, so each lineup name with a match to that artist gets it.
  // source: "musicbrainz" (the MusicBrainz Spotify link), "search" (a Spotify
  // search) or "admin" (the admin set it by hand). A new search does not replace
  // a Spotify artist from the admin. spotify_id and name are NULL when the
  // search found no Spotify artist.
  `CREATE TABLE spotify_artist (
    musicbrainz_id TEXT PRIMARY KEY,
    spotify_id TEXT,
    name TEXT,
    source TEXT NOT NULL CHECK (source IN ('musicbrainz', 'search', 'admin')),
    found_at TEXT NOT NULL,
    CHECK ((spotify_id IS NULL) = (name IS NULL)),
    CHECK (spotify_id IS NOT NULL OR source = 'search')
  ) STRICT`,
  // The interest level of each user for each lineup name (#10). A lineup name
  // belongs to one festival. A missing row means Curious.
  `CREATE TABLE interest_level (
    user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    lineup_name_id INTEGER NOT NULL REFERENCES lineup_name (id) ON DELETE CASCADE,
    level TEXT NOT NULL CHECK (level IN ('not-interested', 'curious', 'keen', 'must-see')),
    PRIMARY KEY (user_id, lineup_name_id)
  ) STRICT`,
  // The predicted songs of each MusicBrainz artist (#12). track_ids: the Spotify
  // track IDs in order of score, as a JSON array. fallback is 1 when the tracks
  // come from a Spotify search because the artist had no setlists. The table
  // contains no setlist.fm data (ADR-0002).
  `CREATE TABLE predicted_songs (
    musicbrainz_id TEXT PRIMARY KEY,
    track_ids TEXT NOT NULL,
    fallback INTEGER NOT NULL CHECK (fallback IN (0, 1)),
    calculated_at TEXT NOT NULL
  ) STRICT`,
  // The venue-and-date results (#13): festival_set is 1 when setlist.fm had
  // enough artists at the venue on the date for a festival set. venue_id is the
  // setlist.fm venue ID. date is YYYY-MM-DD. checked_at is the time of the
  // setlist.fm request. The table keeps no setlists and no artists (ADR-0002).
  `CREATE TABLE venue_date (
    venue_id TEXT NOT NULL,
    date TEXT NOT NULL,
    festival_set INTEGER NOT NULL CHECK (festival_set IN (0, 1)),
    checked_at TEXT NOT NULL,
    PRIMARY KEY (venue_id, date)
  ) STRICT`,
  // The look-back period of each result, in months (#14). A period longer than the
  // usual period is the long look-back mark. The results before this migration
  // used the usual period of 18 months.
  `ALTER TABLE predicted_songs ADD COLUMN look_back_months INTEGER NOT NULL DEFAULT 18 CHECK (look_back_months > 0)`,
  // The playlist of each user for each festival (#15). spotify_id and address: the
  // Spotify playlist. made_at: the time at which Spotify made it. updated_at: the
  // time of the last update that set all of the songs, NULL before the first one.
  // complete is 0 when the last attempt changed the songs but did not set all of them.
  `CREATE TABLE playlist (
    user_id INTEGER NOT NULL REFERENCES user (id) ON DELETE CASCADE,
    festival_id INTEGER NOT NULL REFERENCES festival (id) ON DELETE CASCADE,
    spotify_id TEXT NOT NULL,
    address TEXT NOT NULL,
    made_at TEXT NOT NULL,
    updated_at TEXT,
    complete INTEGER NOT NULL DEFAULT 0 CHECK (complete IN (0, 1)),
    PRIMARY KEY (user_id, festival_id)
  ) STRICT`,
  // The lineup at the last complete update of each playlist (#16). Each artist on the
  // lineup has one row. songs: the number of songs that the artist gave, 0 when it gave
  // none. playlist.changes: the added and removed artists of the last complete update,
  // as JSON {"added": [lineup name ID], "removed": [lineup name ID]}. It is NULL when
  // the update has no earlier lineup to compare with, for example after the first update.
  `CREATE TABLE playlist_artist (
    user_id INTEGER NOT NULL,
    festival_id INTEGER NOT NULL,
    lineup_name_id INTEGER NOT NULL REFERENCES lineup_name (id) ON DELETE CASCADE,
    songs INTEGER NOT NULL CHECK (songs >= 0),
    PRIMARY KEY (user_id, festival_id, lineup_name_id),
    FOREIGN KEY (user_id, festival_id) REFERENCES playlist (user_id, festival_id) ON DELETE CASCADE
  ) STRICT;
  ALTER TABLE playlist ADD COLUMN changes TEXT;`,
  // The new names and the removed names of each lineup check (#17). checked_at is
  // the time of the check, the same as festival.lineup_updated_at after it. The first
  // lineup of a festival has no changes, because there is no lineup to compare with.
  `CREATE TABLE lineup_change (
    lineup_name_id INTEGER NOT NULL REFERENCES lineup_name (id) ON DELETE CASCADE,
    checked_at TEXT NOT NULL,
    change TEXT NOT NULL CHECK (change IN ('new', 'removed')),
    PRIMARY KEY (lineup_name_id, checked_at)
  ) STRICT;
  CREATE INDEX lineup_change_time ON lineup_change (checked_at);`,
];

export function openDatabase(path: string): Database {
  mkdirSync(dirname(path), { recursive: true });
  const database = new DatabaseSync(path);
  database.exec("PRAGMA journal_mode = WAL");
  database.exec("PRAGMA foreign_keys = ON");
  migrate(database);
  return database;
}

function migrate(database: Database): void {
  const { user_version: version } = database.prepare("PRAGMA user_version").get() as {
    user_version: number;
  };
  if (version > migrations.length) {
    throw new Error(
      `The database schema version is ${version}, but this application knows only ${migrations.length} migrations. Use a newer application version.`,
    );
  }
  for (let index = version; index < migrations.length; index++) {
    database.exec("BEGIN");
    try {
      database.exec(migrations[index]!);
      database.exec(`PRAGMA user_version = ${index + 1}`);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
}

export function schemaVersion(database: Database): number {
  const row = database.prepare("PRAGMA user_version").get() as { user_version: number };
  return row.user_version;
}
