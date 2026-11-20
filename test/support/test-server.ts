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
let database = openDatabase(join(directory, `test-${databaseNumber}.sqlite`));
let app = newApp();

function newApp() {
  return createApp({ database, httpClient, clock, settings: testSettings(`http://localhost:${port}`) });
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
    const names = [...festival.artists.map((artist) => artist.name), ...festival.noMatch];
    const lineup = { entries: names.map((name) => ({ name })) };
    await getFestivalLineup(database, { getLineup: async () => ({ outcome: "got", lineup }) }, clock, added.id);
    festival.artists.forEach(({ name, genres, trackIds }, index) => {
      const artist = { id: `test-artist-${index}`, name, genres, ended: false, score: 100, votes: 1, aliases: [] };
      saveArtistMatch(database, clock, name, { kind: "artist", artist });
      if (trackIds !== undefined && trackIds.length > 0) {
        savePredictedSongs(database, artist.id, { trackIds, fallback: false, lookBackMonths: 18, calculatedAt: clock.now() });
      }
    });
    for (const name of festival.noMatch) saveArtistMatch(database, clock, name, { kind: "no-match" });
    const published = publishFestival(database, added.id);
    if (published.outcome !== "published") return context.text(`The test server did not publish ${festival.name}.`, 500);
    return context.json({ id: added.id });
  });

interface PublishedFestivalRequest {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  // trackIds: the predicted songs of the artist. An artist without them has no predicted songs.
  artists: { name: string; genres: string[]; trackIds?: string[] }[];
  noMatch: string[];
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
