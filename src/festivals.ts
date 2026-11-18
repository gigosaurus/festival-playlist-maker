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

export function listPublishedFestivals(database: Database): PublishedFestival[] {
  const rows = database
    .prepare(
      `SELECT id, name, year, start_date, end_date
       FROM festival
       WHERE published = 1
       ORDER BY start_date, name`,
    )
    .all() as { id: number; name: string; year: number; start_date: string; end_date: string }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    year: row.year,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
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
