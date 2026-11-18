import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { systemClock } from "./clock.ts";
import { openDatabase } from "./database.ts";
import { createFetchHttpClient } from "./http-client.ts";

const databasePath = process.env.DATABASE_PATH ?? "data/festival-playlist-maker.sqlite";
const port = Number(process.env.PORT ?? 3000);

const database = openDatabase(databasePath);
const app = createApp({ database, httpClient: createFetchHttpClient(), clock: systemClock });
const server = serve({ fetch: app.fetch, port });
console.log(`Festival Playlist Maker listens on port ${port}. Database: ${databasePath}`);

function stop(): void {
  server.close(() => {
    database.close();
    process.exit(0);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
