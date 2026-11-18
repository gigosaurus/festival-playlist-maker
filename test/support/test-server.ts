// Starts the application for the Playwright tests, with a fake HTTP client, a
// fake clock and a new database file in a temporary directory.
// Tests control the fakes through the /__test/ routes. Only this server has them.
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

const port = Number(process.env.PORT ?? 3100);
const directory = mkdtempSync(join(tmpdir(), "festival-playlist-maker-"));
const database = openDatabase(join(directory, "test.sqlite"));
const httpClient = new FakeHttpClient();
const clock = new FakeClock();

const app = createApp({ database, httpClient, clock });

const control = new Hono()
  .post("/__test/reset", (context) => {
    httpClient.reset();
    clock.set(new FakeClock().now());
    return context.body(null, 204);
  })
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
