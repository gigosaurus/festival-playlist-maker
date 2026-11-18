import { createHash, randomBytes } from "node:crypto";
import type { HttpClient } from "./http-client.ts";
import type { Settings } from "./settings.ts";

// The Spotify authorisation code flow with PKCE.
// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

export const spotifyAuthoriseUrl = "https://accounts.spotify.com/authorize";
export const spotifyTokenUrl = "https://accounts.spotify.com/api/token";
export const spotifyProfileUrl = "https://api.spotify.com/v1/me";

// The playlist builder makes and changes private playlists. A request for the
// scope now means that users do not log in again when the playlist builder starts.
const scopes = ["playlist-modify-private"];

export interface LogInStart {
  // The browser goes to this address to log in with Spotify.
  authoriseUrl: string;
  // The application keeps these two values until Spotify sends the browser back.
  state: string;
  codeVerifier: string;
}

export function startSpotifyLogIn(settings: Settings): LogInStart {
  const state = randomBytes(16).toString("base64url");
  const codeVerifier = randomBytes(64).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const url = new URL(spotifyAuthoriseUrl);
  url.search = new URLSearchParams({
    client_id: settings.spotifyClientId,
    response_type: "code",
    redirect_uri: settings.spotifyRedirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    state,
    scope: scopes.join(" "),
  }).toString();
  return { authoriseUrl: url.href, state, codeVerifier };
}

export interface SpotifyAccount {
  spotifyUserId: string;
  displayName: string;
  refreshToken: string;
}

export type SpotifyLogInResult =
  | { outcome: "logged-in"; account: SpotifyAccount }
  | { outcome: "not-on-allowlist" }
  | { outcome: "failed"; cause: string };

// Changes the authorisation code into tokens, then gets the Spotify profile.
export async function completeSpotifyLogIn(
  httpClient: HttpClient,
  settings: Settings,
  code: string,
  codeVerifier: string,
): Promise<SpotifyLogInResult> {
  const tokenResponse = await send(
    httpClient,
    new Request(spotifyTokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: settings.spotifyRedirectUri,
        client_id: settings.spotifyClientId,
        code_verifier: codeVerifier,
      }),
    }),
  );
  if (!tokenResponse.ok) {
    return { outcome: "failed", cause: await describe("The token request", tokenResponse) };
  }
  const tokens = (await tokenResponse.json()) as { access_token?: string; refresh_token?: string };
  if (!tokens.access_token || !tokens.refresh_token) {
    return { outcome: "failed", cause: "The token response has no access token or no refresh token." };
  }

  const profileResponse = await send(
    httpClient,
    new Request(spotifyProfileUrl, { headers: { authorization: `Bearer ${tokens.access_token}` } }),
  );
  // In Development Mode, Spotify lets a person who is not on the allowlist log in.
  // Then the Web API refuses each request for that person with status 403 (ADR-0001).
  if (profileResponse.status === 403) {
    return { outcome: "not-on-allowlist" };
  }
  if (!profileResponse.ok) {
    return { outcome: "failed", cause: await describe("The profile request", profileResponse) };
  }
  const profile = (await profileResponse.json()) as { id?: string; display_name?: string | null };
  if (!profile.id) {
    return { outcome: "failed", cause: "The profile response has no user ID." };
  }
  return {
    outcome: "logged-in",
    account: {
      spotifyUserId: profile.id,
      displayName: profile.display_name?.trim() || profile.id,
      refreshToken: tokens.refresh_token,
    },
  };
}

// A network failure gives a response with status 599, so that all failures
// follow one path.
async function send(httpClient: HttpClient, request: Request): Promise<Response> {
  try {
    return await httpClient.send(request);
  } catch (error) {
    return new Response(String(error), { status: 599, statusText: "Network failure" });
  }
}

async function describe(name: string, response: Response): Promise<string> {
  const body = (await response.text()).slice(0, 300);
  return `${name} got status ${response.status}: ${body}`;
}
