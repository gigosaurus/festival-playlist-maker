import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { listPublishedFestivals } from "./festivals.ts";
import type { HttpClient } from "./http-client.ts";
import { festivalsPage } from "./pages/festivals-page.ts";
import { notFoundPage } from "./pages/not-found-page.ts";

// The application gets all of its connections to the outside world here.
// main.ts gives the real ones. The tests give a fake HTTP client and a fake clock.
export interface Dependencies {
  database: Database;
  httpClient: HttpClient;
  clock: Clock;
}

const publicDirectory = join(import.meta.dirname, "public");
const staticFiles = {
  "/styles.css": { type: "text/css; charset=utf-8", body: readFileSync(join(publicDirectory, "styles.css")) },
  "/favicon.svg": { type: "image/svg+xml", body: readFileSync(join(publicDirectory, "favicon.svg")) },
};

export function createApp({ database }: Dependencies): Hono {
  const app = new Hono();

  for (const [path, file] of Object.entries(staticFiles)) {
    app.get(path, (context) => context.body(file.body, 200, { "content-type": file.type }));
  }

  app.get("/", (context) => context.html(festivalsPage(listPublishedFestivals(database))));

  app.notFound((context) => context.html(notFoundPage(), 404));

  return app;
}
