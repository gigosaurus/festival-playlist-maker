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
import { openDatabase } from "../../src/database.ts";
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
  .get("/__test/http-requests", (context) => context.json(httpClient.requests));

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
