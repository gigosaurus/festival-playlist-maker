// Records Spotify responses for the Spotify artist tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/spotify/record.ts <database file> <output directory>
// The script gets an access token with the refresh token of the admin in the
// database file. When Spotify gives a new refresh token, the script writes it to
// the database file, so that the application can continue to use it. The script
// reads SPOTIFY_CLIENT_ID and ADMIN_SPOTIFY_USER_ID. It waits 2 seconds between requests.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { spotifyArtistUrl, spotifySearchUrl } from "../../../src/spotify.ts";
import { spotifyTokenUrl } from "../../../src/spotify-log-in.ts";
import { artistFileName, recordedSpotifySearches, searchFileName, spotifyIds } from "../../support/spotify.ts";

const [databasePath, output] = process.argv.slice(2);
const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
const adminId = process.env.ADMIN_SPOTIFY_USER_ID?.trim();
if (databasePath === undefined || output === undefined || !clientId || !adminId) {
  console.error("Usage: node --env-file=.env test/fixtures/spotify/record.ts <database file> <output directory>");
  process.exit(1);
}

const database = new DatabaseSync(databasePath);
const admin = database.prepare("SELECT id, refresh_token FROM user WHERE spotify_user_id = ?").get(adminId) as
  | { id: number; refresh_token: string }
  | undefined;
if (admin === undefined) {
  console.error("The database has no admin. Log in to the application as the admin first.");
  process.exit(1);
}

const tokenResponse = await fetch(spotifyTokenUrl, {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: admin.refresh_token, client_id: clientId }),
});
const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
if (!tokenResponse.ok || tokens.access_token === undefined) {
  console.error(`The token request got status ${tokenResponse.status}.`);
  process.exit(1);
}
if (tokens.refresh_token !== undefined) {
  database.prepare("UPDATE user SET refresh_token = ? WHERE id = ?").run(tokens.refresh_token, admin.id);
}
database.close();

async function record(url: string, file: string): Promise<void> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const body = await response.text();
  if (response.ok) writeFileSync(join(output!, file), `${JSON.stringify(JSON.parse(body), null, 1)}\n`);
  console.log(`${file}: status ${response.status}${response.ok ? "" : ` ${body.slice(0, 300)}`}`);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

for (const id of Object.values(spotifyIds)) await record(spotifyArtistUrl(id), artistFileName(id));
for (const text of recordedSpotifySearches) await record(spotifySearchUrl(text), searchFileName(text));
