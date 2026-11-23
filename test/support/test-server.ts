// Starts the application for the Playwright tests, with a fake HTTP client, a
// fake clock and a new database file in a temporary directory.
// Tests control the fakes through the /__test/ routes. Only this server has them.
// A reset starts a new application with a new database, so that no data, cache
// or request pacing goes from one test to the next.
import "./no-network.ts";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { createApp } from "../../src/app.ts";
import { saveArtistMatch } from "../../src/artist-matches.ts";
import { openDatabase } from "../../src/database.ts";
import { addFestival, publishFestival } from "../../src/festivals.ts";
import { getFestivalLineup } from "../../src/lineups.ts";
import { savePredictedSongs } from "../../src/predicted-songs.ts";
import { FakeClock } from "./fake-clock.ts";
import { FakeHttpClient, type RecordedResponse } from "./fake-http-client.ts";
import { testSettings } from "./test-settings.ts";

const port = Number(process.env.PORT ?? 3100);
const directory = mkdtempSync(join(tmpdir(), "festival-playlist-maker-"));
const httpClient = new FakeHttpClient();
let clock = new FakeClock();
let databaseNumber = 0;
// The task of the lineup check schedule. It runs only when a test asks (/__test/lineup-check).
let scheduledTask: (() => Promise<void>) | undefined;
let database = openDatabase(join(directory, `test-${databaseNumber}.sqlite`));
let app = newApp();

function newApp() {
  return createApp({
    database,
    httpClient,
    clock,
    settings: testSettings(`http://localhost:${port}`),
    schedule: (task) => {
      scheduledTask = task;
    },
  });
}

const control = new Hono()
  .post("/__test/reset", (context) => {
    httpClient.reset();
    clock = new FakeClock();
    database.close();
    databaseNumber++;
    database = openDatabase(join(directory, `test-${databaseNumber}.sqlite`));
    app = newApp();
    return context.body(null, 204);
  })
  .get("/__test/sleeps", (context) => context.json(clock.sleeps))
  .get("/__test/clock", (context) => context.json({ now: clock.now().toISOString() }))
  .post("/__test/clock", async (context) => {
    const { now } = await context.req.json<{ now: string }>();
    clock.set(new Date(now));
    return context.body(null, 204);
  })
  .post("/__test/http-responses", async (context) => {
    const { method, url, response } = await context.req.json<{
      method: string;
      url: string;
      response: RecordedResponse;
    }>();
    httpClient.respondTo(method, url, response);
    return context.body(null, 204);
  })
  .get("/__test/http-requests", (context) => context.json(httpClient.requests))
  // Runs the scheduled lineup check one time, as the timer does each hour, and waits for it.
  .post("/__test/lineup-check", async (context) => {
    await scheduledTask!();
    return context.body(null, 204);
  })
  // Adds a published festival with a lineup, without the admin pages. Each
  // artist gets an artist match. Each name in noMatch is marked "no match".
  // For tests that need a large lineup.
  .post("/__test/published-festivals", async (context) => {
    const festival = await context.req.json<PublishedFestivalRequest>();
    const added = addFestival(
      database,
      { ...festival, expectedGenres: [], page: "test" },
      { source: "clashfinder", page: "test", pageName: festival.name },
    );
    if (added.outcome !== "added") return context.text(`${festival.name} ${festival.year} exists.`, 400);
    await setLineup(added.id, festival);
    const published = publishFestival(database, added.id);
    if (published.outcome !== "published") return context.text(`The test server did not publish ${festival.name}.`, 500);
    return context.json({ id: added.id });
  })
  // Gives a festival a new lineup, as "Get the lineup again" and the artist matches do.
  // Each artist gets an artist match. Each name in noMatch is marked "no match".
  .post("/__test/published-festivals/:id/lineup", async (context) => {
    await setLineup(Number(context.req.param("id")), await context.req.json<LineupRequest>());
    return context.body(null, 204);
  });

async function setLineup(festivalId: number, { artists, noMatch }: LineupRequest): Promise<void> {
  const names = [...artists.map((artist) => artist.name), ...noMatch];
  const lineup = { entries: names.map((name) => ({ name })) };
  await getFestivalLineup(database, { getLineup: async () => ({ outcome: "got", lineup }) }, clock, festivalId);
  for (const { name, genres, trackIds } of artists) {
    const artist = { id: `test-artist-${name}`, name, genres, ended: false, score: 100, votes: 1, aliases: [] };
    saveArtistMatch(database, clock, name, { kind: "artist", artist });
    if (trackIds !== undefined && trackIds.length > 0) {
      savePredictedSongs(database, artist.id, { trackIds, fallback: false, lookBackMonths: 18, calculatedAt: clock.now() });
    }
  }
  for (const name of noMatch) saveArtistMatch(database, clock, name, { kind: "no-match" });
}

interface LineupRequest {
  // trackIds: the predicted songs of the artist. An artist without them has no predicted songs.
  artists: { name: string; genres: string[]; trackIds?: string[] }[];
  noMatch: string[];
}

interface PublishedFestivalRequest extends LineupRequest {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
}

const server = serve({
  port,
  fetch: (request) =>
    new URL(request.url).pathname.startsWith("/__test/") ? control.fetch(request) : app.fetch(request),
});
console.log(`Test server listens on port ${port}.`);

function stop(): void {
  server.close(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
