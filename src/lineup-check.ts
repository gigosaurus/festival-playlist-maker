import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { londonDate } from "./festivals.ts";
import type { LineupResult } from "./lineup-source.ts";

// The daily lineup check (#17, user stories 47 to 49 and 52). The application
// checks the lineup of each published festival once a day until the festival
// starts. A check by the admin ("Get the lineup again") also counts for the day.

// A schedule runs a task again and again. main.ts gives a timer. The test server
// gives a schedule that runs the task only when a test asks, with the fake clock.
export type Schedule = (task: () => Promise<void>) => void;

// The interval of the timer. A festival is due one time each day, so a shorter
// interval does not send more requests. It only makes the first check of a day earlier.
export const checkInterval = 60 * 60_000;

// The maximum number of checks in one run. Clashfinder accepts a maximum of 10
// requests in 5 minutes (ADR-0006). This keeps requests available for the admin.
// The festivals that are still due get their check in the next run.
export const maximumChecksInRun = 5;

// The published festivals that need a check now, the festival that starts first
// first. A festival is due when its last check was not today (in the United
// Kingdom) and the festival starts after today.
export function dueFestivals(database: Database, now: Date): number[] {
  const today = londonDate(now);
  const rows = database
    .prepare(
      `SELECT id, lineup_checked_at FROM festival
       WHERE published = 1 AND start_date > ?
       ORDER BY start_date, id`,
    )
    .all(today) as { id: number; lineup_checked_at: string | null }[];
  return rows
    .filter((row) => row.lineup_checked_at === null || londonDate(new Date(row.lineup_checked_at)) < today)
    .map((row) => row.id);
}

// checkLineup: gets and stores the lineup of one festival (getFestivalLineup),
// and starts the work that a new lineup needs.
export async function checkDueLineups(
  database: Database,
  clock: Clock,
  checkLineup: (festivalId: number) => Promise<LineupResult>,
): Promise<void> {
  for (const festivalId of dueFestivals(database, clock.now()).slice(0, maximumChecksInRun)) {
    await checkLineup(festivalId);
  }
}

// Runs the task at the start and then after each interval. A run does not start
// while the previous run continues. An error is logged, and the next run continues.
export function timerSchedule(interval: number): Schedule {
  return (task) => {
    let running = false;
    const run = () => {
      if (running) return;
      running = true;
      task()
        .catch((error: unknown) => console.error("The lineup check stopped because of an error.", error))
        .finally(() => {
          running = false;
        });
    };
    setTimeout(run, 0).unref();
    setInterval(run, interval).unref();
  };
}
