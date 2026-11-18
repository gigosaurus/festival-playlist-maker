import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { systemClock } from "./clock.ts";
import { openDatabase } from "./database.ts";
import { createFetchHttpClient } from "./http-client.ts";
import type { Settings } from "./settings.ts";

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
const settings: Settings = {
  spotifyClientId: requiredSetting("SPOTIFY_CLIENT_ID"),
  adminSpotifyUserId: requiredSetting("ADMIN_SPOTIFY_USER_ID"),
  // Spotify accepts an HTTP redirect URI only for a loopback address, for example 127.0.0.1.
  spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI?.trim() || `http://127.0.0.1:${port}/log-in/callback`,
  clashfinderUsername: requiredSetting("CLASHFINDER_USERNAME"),
  clashfinderPrivateKey: requiredSetting("CLASHFINDER_PRIVATE_KEY"),
};

const database = openDatabase(databasePath);
const app = createApp({ database, httpClient: createFetchHttpClient(), clock: systemClock, settings });
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
