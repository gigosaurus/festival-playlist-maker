import type { Database } from "./database.ts";

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
