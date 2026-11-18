import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { Lineup, LineupResult, LineupSource, LineupSourceSettings } from "./lineup-source.ts";

// Gets the lineup of a festival from its lineup source and stores it. When the
// lineup source fails, the festival keeps its previous lineup, and the database
// records the time and the cause.
export async function getFestivalLineup(
  database: Database,
  lineupSource: LineupSource,
  clock: Clock,
  festivalId: number,
): Promise<LineupResult> {
  const row = database.prepare("SELECT lineup_source_settings FROM festival WHERE id = ?").get(festivalId) as
    | { lineup_source_settings: string }
    | undefined;
  if (row === undefined) throw new Error(`There is no festival with ID ${festivalId}.`);
  const settings = JSON.parse(row.lineup_source_settings) as LineupSourceSettings;

  const result = await lineupSource.getLineup(settings);
  const at = clock.now().toISOString();
  if (result.outcome === "got") saveLineup(database, festivalId, result.lineup, at);
  else {
    database
      .prepare("UPDATE festival SET lineup_checked_at = ?, lineup_problem = ? WHERE id = ?")
      .run(at, result.cause, festivalId);
  }
  return result;
}

export interface StoredLineupName {
  name: string;
  firstSeen: string;
  lastSeen: string;
  times: { day: string | null; stage: string | null; start: string | null; end: string | null }[];
}

// The names on the current lineup of a festival, in alphabetical order.
export function currentLineup(database: Database, festivalId: number): StoredLineupName[] {
  const names = database
    .prepare(
      `SELECT lineup_name.id, lineup_name.name, lineup_name.first_seen, lineup_name.last_seen
       FROM lineup_name JOIN festival ON festival.id = lineup_name.festival_id
       WHERE festival.id = ? AND lineup_name.last_seen = festival.lineup_updated_at
       ORDER BY lineup_name.name COLLATE NOCASE, lineup_name.name`,
    )
    .all(festivalId) as { id: number; name: string; first_seen: string; last_seen: string }[];
  const times = database.prepare(
    `SELECT day, stage, start_time, end_time FROM lineup_time
     WHERE lineup_name_id = ? ORDER BY start_time, rowid`,
  );
  return names.map((row) => ({
    name: row.name,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    times: (times.all(row.id) as { day: string | null; stage: string | null; start_time: string | null; end_time: string | null }[]).map(
      (time) => ({ day: time.day, stage: time.stage, start: time.start_time, end: time.end_time }),
    ),
  }));
}

function saveLineup(database: Database, festivalId: number, lineup: Lineup, at: string): void {
  const entriesByName = new Map<string, Lineup["entries"]>();
  for (const entry of lineup.entries) {
    const entries = entriesByName.get(entry.name) ?? [];
    entries.push(entry);
    entriesByName.set(entry.name, entries);
  }

  const saveName = database.prepare(
    `INSERT INTO lineup_name (festival_id, name, first_seen, last_seen) VALUES (?, ?, ?, ?)
     ON CONFLICT (festival_id, name) DO UPDATE SET last_seen = excluded.last_seen
     RETURNING id`,
  );
  const deleteTimes = database.prepare("DELETE FROM lineup_time WHERE lineup_name_id = ?");
  const insertTime = database.prepare(
    "INSERT INTO lineup_time (lineup_name_id, day, stage, start_time, end_time) VALUES (?, ?, ?, ?, ?)",
  );

  database.exec("BEGIN");
  try {
    for (const [name, entries] of entriesByName) {
      const { id } = saveName.get(festivalId, name, at, at) as { id: number };
      deleteTimes.run(id);
      for (const entry of entries) {
        if (entry.day === undefined && entry.stage === undefined && entry.start === undefined && entry.end === undefined) continue;
        insertTime.run(id, entry.day ?? null, entry.stage ?? null, entry.start ?? null, entry.end ?? null);
      }
    }
    database
      .prepare(
        `UPDATE festival
         SET lineup_timezone = ?, lineup_updated_at = ?, lineup_checked_at = ?, lineup_problem = NULL
         WHERE id = ?`,
      )
      .run(lineup.timezone ?? null, at, at, festivalId);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
