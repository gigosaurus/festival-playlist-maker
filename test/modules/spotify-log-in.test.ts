import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  completeSpotifyLogIn,
  spotifyProfileUrl,
  spotifyTokenUrl,
  startSpotifyLogIn,
} from "../../src/spotify-log-in.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import {
  spotifyNotOnAllowlistResponse,
  spotifyProfileResponse,
  spotifyTokenResponse,
  testSettings,
} from "../support/test-settings.ts";

const settings = testSettings();

test("startSpotifyLogIn gives a Spotify address with a PKCE challenge for the code verifier", () => {
  const start = startSpotifyLogIn(settings);

  const url = new URL(start.authoriseUrl);
  assert.equal(url.origin + url.pathname, "https://accounts.spotify.com/authorize");
  assert.equal(url.searchParams.get("client_id"), "test-client-id");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3100/log-in/callback");
  assert.equal(url.searchParams.get("state"), start.state);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(
    url.searchParams.get("code_challenge"),
    createHash("sha256").update(start.codeVerifier).digest("base64url"),
  );
  assert.ok(start.codeVerifier.length >= 43 && start.codeVerifier.length <= 128);
  assert.equal(url.searchParams.get("scope"), "playlist-modify-private");
});

test("startSpotifyLogIn gives a different state and code verifier each time", () => {
  const first = startSpotifyLogIn(settings);
  const second = startSpotifyLogIn(settings);

  assert.notEqual(first.state, second.state);
  assert.notEqual(first.codeVerifier, second.codeVerifier);
});

test("completeSpotifyLogIn gives the Spotify account and the refresh token", async () => {
  const httpClient = new FakeHttpClient();
  httpClient.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse("refresh-token-7"));
  httpClient.respondTo("GET", spotifyProfileUrl, spotifyProfileResponse("alex", "Alex"));

  const result = await completeSpotifyLogIn(httpClient, settings, "the-code", "the-verifier");

  assert.deepEqual(result, {
    outcome: "logged-in",
    account: { spotifyUserId: "alex", displayName: "Alex", refreshToken: "refresh-token-7" },
  });
  const tokenRequest = new URLSearchParams(httpClient.requests[0]!.body);
  assert.deepEqual(Object.fromEntries(tokenRequest), {
    grant_type: "authorization_code",
    code: "the-code",
    redirect_uri: "http://localhost:3100/log-in/callback",
    client_id: "test-client-id",
    code_verifier: "the-verifier",
  });
});

test("completeSpotifyLogIn uses the Spotify user ID when the account has no display name", async () => {
  const httpClient = new FakeHttpClient();
  httpClient.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
  httpClient.respondTo("GET", spotifyProfileUrl, spotifyProfileResponse("sam", null));

  const result = await completeSpotifyLogIn(httpClient, settings, "code", "verifier");

  assert.equal(result.outcome === "logged-in" && result.account.displayName, "sam");
});

test("completeSpotifyLogIn finds a person who is not on the allowlist", async () => {
  const httpClient = new FakeHttpClient();
  httpClient.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
  httpClient.respondTo("GET", spotifyProfileUrl, spotifyNotOnAllowlistResponse);

  const result = await completeSpotifyLogIn(httpClient, settings, "code", "verifier");

  assert.deepEqual(result, { outcome: "not-on-allowlist" });
});

test("completeSpotifyLogIn fails with the cause when Spotify refuses the code", async () => {
  const httpClient = new FakeHttpClient();
  httpClient.respondTo("POST", spotifyTokenUrl, {
    status: 400,
    headers: { "content-type": "application/json" },
    body: '{"error":"invalid_grant","error_description":"Invalid authorization code"}',
  });

  const result = await completeSpotifyLogIn(httpClient, settings, "old-code", "verifier");

  assert.equal(result.outcome, "failed");
  assert.match(result.outcome === "failed" ? result.cause : "", /token request got status 400.*invalid_grant/);
  assert.equal(httpClient.requests.length, 1, "No profile request after a refused code");
});

test("completeSpotifyLogIn fails when Spotify limits requests or the network fails", async () => {
  const httpClient = new FakeHttpClient();
  httpClient.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
  httpClient.respondTo("GET", spotifyProfileUrl, { status: 429, headers: { "retry-after": "30" } });

  const limited = await completeSpotifyLogIn(httpClient, settings, "code", "verifier");
  assert.equal(limited.outcome, "failed");

  // The fake HTTP client has no response for the token request, so the request fails.
  const unreachable = await completeSpotifyLogIn(new FakeHttpClient(), settings, "code", "verifier");
  assert.equal(unreachable.outcome, "failed");
});
