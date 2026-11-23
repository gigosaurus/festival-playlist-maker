import { festivalArtistMatches } from "./artist-matches.ts";
import type { Database } from "./database.ts";
import type { ValidFestival } from "./festival-form.ts";
import type { LineupSourceSettings } from "./lineup-source.ts";

export interface PublishedFestival {
  id: number;
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}

// The published festivals for the Festivals page. A festival is complete after
// its last day. The festivals that are still to come include a festival that is
// on today. They show first, the next festival first. The complete festivals
// show below them, the most recent festival first (user story 10).
// today: the ISO date in the time zone of the users (see londonDate).
export function listPublishedFestivals(database: Database, today: string): { toCome: PublishedFestival[]; complete: PublishedFestival[] } {
  const festivals = database
    .prepare(
      `SELECT id, name, year, start_date, end_date
       FROM festival
       WHERE published = 1
       ORDER BY start_date, name`,
    )
    .all() as unknown as PublishedFestivalRow[];
  const all = festivals.map(toPublishedFestival);
  return {
    toCome: all.filter((festival) => festival.endDate >= today),
    complete: all.filter((festival) => festival.endDate < today).reverse(),
  };
}

export function findPublishedFestival(database: Database, id: number): PublishedFestival | undefined {
  const row = database
    .prepare("SELECT id, name, year, start_date, end_date FROM festival WHERE id = ? AND published = 1")
    .get(id) as PublishedFestivalRow | undefined;
  return row === undefined ? undefined : toPublishedFestival(row);
}

// The date in the United Kingdom, where the users and the festivals are. A
// festival is complete at midnight in the United Kingdom, not in UTC.
export function londonDate(time: Date): string {
  return londonDateFormat.format(time);
}

// The en-CA locale gives ISO dates, for example "2027-06-11".
const londonDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" });

interface PublishedFestivalRow {
  id: number;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
}

function toPublishedFestival(row: PublishedFestivalRow): PublishedFestival {
  return { id: row.id, name: row.name, year: row.year, startDate: row.start_date, endDate: row.end_date };
}

// The result of an attempt to publish a festival. "unmatched": the number of
// current lineup names without an artist match and without a "no match" mark.
export type PublishResult = { outcome: "published" } | { outcome: "no-lineup" } | { outcome: "unmatched"; unmatched: number };

// The admin can publish a festival only when each name on its lineup has an
// artist match or is marked "no match" (user story 51). A festival without a
// lineup has nothing for users to see, so the admin cannot publish it.
export function publishFestival(database: Database, id: number): PublishResult {
  const names = festivalArtistMatches(database, id);
  if (names.length === 0) return { outcome: "no-lineup" };
  const unmatched = names.filter((name) => name.match === undefined).length;
  if (unmatched > 0) return { outcome: "unmatched", unmatched };
  database.prepare("UPDATE festival SET published = 1 WHERE id = ?").run(id);
  return { outcome: "published" };
}

// A festival as the admin sees it on the festival list.
export interface AdminFestival extends PublishedFestival {
  published: boolean;
  expectedGenres: string[];
  lineupSource: LineupSourceSettings;
  // The number of names on the current lineup.
  lineupNames: number;
  // The time of the last lineup that the application got.
  lineupUpdatedAt?: Date;
  // The time and the cause of failure of the last attempt, when it failed.
  lineupProblem?: { at: Date; cause: string };
}

export type AddResult = { outcome: "added"; id: number } | { outcome: "exists" };

export function addFestival(database: Database, festival: ValidFestival, lineupSource: LineupSourceSettings): AddResult {
  const existing = database.prepare("SELECT id FROM festival WHERE name = ? AND year = ?").get(festival.name, festival.year);
  if (existing !== undefined) return { outcome: "exists" };

  database.exec("BEGIN");
  try {
    const { id } = database
      .prepare(
        `INSERT INTO festival (name, year, start_date, end_date, lineup_source, lineup_source_settings)
         VALUES (?, ?, ?, ?, ?, ?)
         RETURNING id`,
      )
      .get(
        festival.name,
        festival.year,
        festival.startDate,
        festival.endDate,
        lineupSource.source,
        JSON.stringify(lineupSource),
      ) as { id: number };
    const insertGenre = database.prepare("INSERT INTO expected_genre (festival_id, name) VALUES (?, ?)");
    for (const genre of festival.expectedGenres) insertGenre.run(id, genre);
    database.exec("COMMIT");
    return { outcome: "added", id };
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

// The admin changes the lineup source (user story 50). The lineup stays until
// the next lineup check gets the lineup from the new source.
export function changeLineupSource(database: Database, id: number, lineupSource: LineupSourceSettings): void {
  database
    .prepare("UPDATE festival SET lineup_source = ?, lineup_source_settings = ? WHERE id = ?")
    .run(lineupSource.source, JSON.stringify(lineupSource), id);
}

// All festivals, the festival with the latest start date first.
export function listFestivalsForAdmin(database: Database): AdminFestival[] {
  const rows = database
    .prepare(
      `SELECT festival.*,
         (SELECT count(*) FROM lineup_name
          WHERE lineup_name.festival_id = festival.id AND lineup_name.last_seen = festival.lineup_updated_at) AS lineup_names,
         (SELECT json_group_array(name) FROM (SELECT name FROM expected_genre
          WHERE expected_genre.festival_id = festival.id ORDER BY rowid)) AS expected_genres
       FROM festival
       ORDER BY start_date DESC, name`,
    )
    .all() as unknown as FestivalRow[];
  return rows.map(toAdminFestival);
}

export function findFestivalForAdmin(database: Database, id: number): AdminFestival | undefined {
  return listFestivalsForAdmin(database).find((festival) => festival.id === id);
}

interface FestivalRow {
  id: number;
  name: string;
  year: number;
  start_date: string;
  end_date: string;
  published: number;
  lineup_source_settings: string;
  lineup_updated_at: string | null;
  lineup_checked_at: string | null;
  lineup_problem: string | null;
  lineup_names: number;
  expected_genres: string;
}

function toAdminFestival(row: FestivalRow): AdminFestival {
  const festival: AdminFestival = {
    id: row.id,
    name: row.name,
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
    published: row.published === 1,
    expectedGenres: JSON.parse(row.expected_genres) as string[],
    lineupSource: JSON.parse(row.lineup_source_settings) as LineupSourceSettings,
    lineupNames: row.lineup_names,
  };
  if (row.lineup_updated_at !== null) festival.lineupUpdatedAt = new Date(row.lineup_updated_at);
  if (row.lineup_problem !== null && row.lineup_checked_at !== null) {
    festival.lineupProblem = { at: new Date(row.lineup_checked_at), cause: row.lineup_problem };
  }
  return festival;
}
