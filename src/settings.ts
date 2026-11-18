// The settings that the application gets from its environment.
export interface Settings {
  // The client ID of the Spotify developer app. The application uses PKCE and
  // has no client secret (ADR-0001).
  spotifyClientId: string;
  // The Spotify user ID of the admin: the account that owns the developer app.
  adminSpotifyUserId: string;
  // The redirect URI in the Spotify developer app. It must be the same text.
  spotifyRedirectUri: string;
}
