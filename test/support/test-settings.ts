import { defaultPlaylistSettings, defaultPredictionSettings, type Settings } from "../../src/settings.ts";
import type { RecordedResponse } from "./fake-http-client.ts";

export const adminSpotifyUserId = "festival-admin";

export function testSettings(origin = "http://localhost:3100"): Settings {
  return {
    spotifyClientId: "test-client-id",
    adminSpotifyUserId,
    spotifyRedirectUri: `${origin}/log-in/callback`,
    clashfinderUsername: "test-clashfinder-user",
    clashfinderPrivateKey: "test-clashfinder-private-key",
    musicbrainzContact: "admin@festival-playlist-maker.test",
    setlistFmApiKey: "test-setlist-fm-key",
    prediction: defaultPredictionSettings,
    playlist: defaultPlaylistSettings,
  };
}

// Recorded Spotify responses for a log in. The shapes agree with the Spotify Web API reference.
export function spotifyTokenResponse(refreshToken = "refresh-token-1"): RecordedResponse {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      access_token: "access-token-1",
      token_type: "Bearer",
      scope: "playlist-modify-private",
      expires_in: 3600,
      refresh_token: refreshToken,
    }),
  };
}

export function spotifyProfileResponse(id: string, displayName: string | null): RecordedResponse {
  return {
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id,
      display_name: displayName,
      type: "user",
      uri: `spotify:user:${id}`,
      href: `https://api.spotify.com/v1/users/${id}`,
      external_urls: { spotify: `https://open.spotify.com/user/${id}` },
      images: [],
      followers: { href: null, total: 0 },
    }),
  };
}

// Spotify Development Mode gives this response for a person who is not on the allowlist.
export const spotifyNotOnAllowlistResponse: RecordedResponse = {
  status: 403,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    error: {
      status: 403,
      message: "Check settings on developer.spotify.com/dashboard, the user may not be registered.",
    },
  }),
};
