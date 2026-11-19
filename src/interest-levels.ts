import { festivalArtistMatches } from "./artist-matches.ts";
import type { Database } from "./database.ts";

// Interest levels (issue #1, user stories 11 to 19). The interest level of an
// artist sets how many songs of the artist the playlist contains. Each user has
// an interest level for each artist on the lineup. Curious is the default.

// The levels, from the lowest to the highest.
export const interestLevels = ["not-interested", "curious", "keen", "must-see"] as const;

export type InterestLevel = (typeof interestLevels)[number];

export const defaultInterestLevel: InterestLevel = "curious";

// The names in the interface and in the glossary.
export const interestLevelNames: Record<InterestLevel, string> = {
  "not-interested": "Not interested",
  curious: "Curious",
  keen: "Keen",
  "must-see": "Must see",
};

export function isInterestLevel(value: unknown): value is InterestLevel {
  return typeof value === "string" && (interestLevels as readonly string[]).includes(value);
}

// One artist on the lineup of a festival, as one user sees it.
export interface LineupArtist {
  lineupNameId: number;
  // The lineup name, as the lineup source gives it.
  name: string;
  // The genres of the MusicBrainz artist, the genre with the most votes first.
  genres: string[];
  level: InterestLevel;
}

// Each name on the current lineup that has an artist match, in alphabetical
// order, with the interest level of the user. Names marked "no match" are not
// artists, so they are not included.
export function festivalLineup(database: Database, festivalId: number, userId: number): LineupArtist[] {
  const levels = new Map(
    (
      database
        .prepare(
          `SELECT interest_level.lineup_name_id, interest_level.level
           FROM interest_level JOIN lineup_name ON lineup_name.id = interest_level.lineup_name_id
           WHERE interest_level.user_id = ? AND lineup_name.festival_id = ?`,
        )
        .all(userId, festivalId) as { lineup_name_id: number; level: InterestLevel }[]
    ).map((row) => [row.lineup_name_id, row.level]),
  );
  return festivalArtistMatches(database, festivalId).flatMap(({ lineupNameId, name, match }) =>
    match?.kind === "artist"
      ? [{ lineupNameId, name, genres: match.artist.genres, level: levels.get(lineupNameId) ?? defaultInterestLevel }]
      : [],
  );
}

// The number of artists that the playlist will contain: each artist that does
// not have the interest level Not interested.
export function playlistArtistCount(artists: LineupArtist[]): number {
  return artists.filter((artist) => artist.level !== "not-interested").length;
}

export type SaveResult = { outcome: "saved" } | { outcome: "not-on-lineup"; lineupNameId: number };

// Saves interest levels of one user for artists on the lineup of one festival.
// It saves nothing when one lineup name is not an artist on the current lineup.
export function saveInterestLevels(
  database: Database,
  festivalId: number,
  userId: number,
  levels: Map<number, InterestLevel>,
): SaveResult {
  const artists = new Set(festivalLineup(database, festivalId, userId).map((artist) => artist.lineupNameId));
  for (const lineupNameId of levels.keys()) {
    if (!artists.has(lineupNameId)) return { outcome: "not-on-lineup", lineupNameId };
  }
  const save = database.prepare(
    `INSERT INTO interest_level (user_id, lineup_name_id, level) VALUES (?, ?, ?)
     ON CONFLICT (user_id, lineup_name_id) DO UPDATE SET level = excluded.level`,
  );
  database.exec("BEGIN");
  try {
    for (const [lineupNameId, level] of levels) save.run(userId, lineupNameId, level);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return { outcome: "saved" };
}
