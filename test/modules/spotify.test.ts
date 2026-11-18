import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { withServiceRules } from "../../src/http-client.ts";
import { createSessions } from "../../src/sessions.ts";
import { createSpotify, readSpotifyArtistId, spotifyArtistUrl, spotifySearchUrl } from "../../src/spotify.ts";
import { spotifyTokenUrl } from "../../src/spotify-log-in.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { notFoundResponse, respondWithRecordedSpotify, spotifyIds } from "../support/spotify.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { adminSpotifyUserId, spotifyTokenResponse, testSettings } from "../support/test-settings.ts";

function setUp(t: TestContext, { admin = true } = {}) {
  const database = openDatabase(temporaryDatabasePath(t));
  t.after(() => database.close());
  const clock = new FakeClock();
  const settings = testSettings();
  if (admin) {
    createSessions(database, clock, settings).logIn({ spotifyUserId: adminSpotifyUserId, displayName: "Kit Admin", refreshToken: "refresh-token-0" });
  }
  const transport = new FakeHttpClient();
  respondWithRecordedSpotify((method, url, response) => transport.respondTo(method, url, response));
  const spotify = createSpotify(withServiceRules(transport, settings, clock), database, clock, settings);
  return { database, clock, transport, spotify };
}

const storedRefreshToken = (database: ReturnType<typeof openDatabase>) =>
  (database.prepare("SELECT refresh_token FROM user WHERE spotify_user_id = ?").get(adminSpotifyUserId) as { refresh_token: string }).refresh_token;

test("the Spotify module gets an artist with an access token from the refresh token of the admin", async (t) => {
  const { database, transport, spotify } = setUp(t);

  const result = await spotify.artist(spotifyIds.bringMeTheHorizon);

  assert.deepEqual(result, { outcome: "found", artist: { id: spotifyIds.bringMeTheHorizon, name: "Bring Me The Horizon" } });
  const [token, artist] = transport.requests;
  assert.equal(token!.url, spotifyTokenUrl);
  assert.deepEqual(Object.fromEntries(new URLSearchParams(token!.body)), {
    grant_type: "refresh_token",
    refresh_token: "refresh-token-0",
    client_id: "test-client-id",
  });
  assert.equal(artist!.url, spotifyArtistUrl(spotifyIds.bringMeTheHorizon));
  // Spotify gave a new refresh token. The old one is not valid.
  assert.equal(storedRefreshToken(database), "refresh-token-1");
});

test("the Spotify module uses the access token again until it expires", async (t) => {
  const { clock, transport, spotify } = setUp(t);

  await spotify.artist(spotifyIds.evanescence);
  await spotify.artist(spotifyIds.theProdigy);
  clock.advance(60 * 60_000);
  await spotify.artist(spotifyIds.turnstile);

  assert.equal(transport.requests.filter(({ url }) => url === spotifyTokenUrl).length, 2);
});

test("after status 401, the Spotify module gets a new access token and sends the request again", async (t) => {
  const { transport, spotify } = setUp(t);
  await spotify.artist(spotifyIds.evanescence);
  const url = spotifyArtistUrl(spotifyIds.theProdigy);
  const recorded = transport.send.bind(transport);
  let refused = false;
  transport.send = async (request) => {
    if (request.url === url && !refused) {
      refused = true;
      transport.requests.push({ method: "GET", url });
      return new Response('{"error":{"status":401,"message":"The access token expired"}}', { status: 401 });
    }
    return recorded(request);
  };

  const result = await spotify.artist(spotifyIds.theProdigy);

  assert.equal(result.outcome, "found");
  assert.deepEqual(
    transport.requests.slice(2).map(({ url }) => url),
    [url, spotifyTokenUrl, url],
  );
});

test("an artist ID that Spotify does not have gives “not found”", async (t) => {
  const { transport, spotify } = setUp(t);
  transport.respondTo("GET", spotifyArtistUrl("0000000000000000000000"), notFoundResponse);

  assert.deepEqual(await spotify.artist("0000000000000000000000"), { outcome: "not-found" });
  assert.deepEqual(await spotify.artist("not-an-id"), { outcome: "not-found" });
});

test("a search gives the artists in the Spotify order", async (t) => {
  const { transport, spotify } = setUp(t);

  const result = await spotify.searchArtists("Ghost");

  assert.equal(result.outcome, "found");
  assert.deepEqual(result.outcome === "found" && result.artists.slice(0, 2), [
    { id: spotifyIds.ghostSweden, name: "Ghost" },
    { id: "6kQB2RN7WwryMdJ1MoQh1E", name: "The Ghost Inside" },
  ]);
  assert.equal(transport.requests[1]!.url, spotifySearchUrl("Ghost"));
  assert.equal(new URL(spotifySearchUrl("Ghost")).searchParams.get("limit"), "5");
});

test("without a logged-in admin, the Spotify module gives the cause", async (t) => {
  const { transport, spotify } = setUp(t, { admin: false });

  const result = await spotify.artist(spotifyIds.evanescence);

  assert.deepEqual(result, {
    outcome: "failed",
    cause: "The admin has not logged in, so the application has no Spotify access token. Log in as the admin.",
  });
  assert.equal(transport.requests.length, 0);
});

test("a refused refresh token gives the cause", async (t) => {
  const { transport, spotify } = setUp(t);
  transport.respondTo("POST", spotifyTokenUrl, {
    status: 400,
    headers: { "content-type": "application/json" },
    body: '{"error":"invalid_grant","error_description":"Refresh token revoked"}',
  });

  const result = await spotify.searchArtists("Ghost");

  assert.deepEqual(result, {
    outcome: "failed",
    cause: "Spotify refused the refresh token of the admin. Log out, then log in again as the admin.",
  });
});

test("a token response without a new refresh token keeps the stored refresh token", async (t) => {
  const { database, transport, spotify } = setUp(t);
  const { refresh_token: _, ...withoutRefreshToken } = JSON.parse(spotifyTokenResponse().body!) as Record<string, unknown>;
  transport.respondTo("POST", spotifyTokenUrl, { body: JSON.stringify(withoutRefreshToken) });

  await spotify.artist(spotifyIds.evanescence);

  assert.equal(storedRefreshToken(database), "refresh-token-0");
});

test("readSpotifyArtistId reads an address, a Spotify URI or an ID", () => {
  const id = spotifyIds.bringMeTheHorizon;
  assert.equal(readSpotifyArtistId(`https://open.spotify.com/artist/${id}?si=abc123`), id);
  assert.equal(readSpotifyArtistId(` https://open.spotify.com/intl-de/artist/${id} `), id);
  assert.equal(readSpotifyArtistId(`spotify:artist:${id}`), id);
  assert.equal(readSpotifyArtistId(id), id);
  assert.equal(readSpotifyArtistId(`https://open.spotify.com/album/${id}`), undefined);
  assert.equal(readSpotifyArtistId("https://open.spotify.com/user/piercetheveilband"), undefined);
  assert.equal(readSpotifyArtistId("Bring Me The Horizon"), undefined);
  assert.equal(readSpotifyArtistId(""), undefined);
});
