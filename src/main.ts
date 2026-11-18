import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { systemClock } from "./clock.ts";
import { openDatabase } from "./database.ts";
import { createFetchHttpClient } from "./http-client.ts";

function requiredSetting(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`The application cannot start. Set ${name} in the .env file. The README tells you how to find the value.`);
    process.exit(1);
  }
  return value;
}

const databasePath = process.env.DATABASE_PATH ?? "data/festival-playlist-maker.sqlite";
const port = Number(process.env.PORT ?? 3000);
const spotifyClientId = requiredSetting("SPOTIFY_CLIENT_ID");
const adminSpotifyUserId = requiredSetting("ADMIN_SPOTIFY_USER_ID");

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
