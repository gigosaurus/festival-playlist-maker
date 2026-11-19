// The settings that the application gets from its environment.
export interface Settings {
  // The client ID of the Spotify developer app. The application uses PKCE and
  // has no client secret (ADR-0001).
  spotifyClientId: string;
  // The Spotify user ID of the admin: the account that owns the developer app.
  adminSpotifyUserId: string;
  // The redirect URI in the Spotify developer app. It must be the same text.
  spotifyRedirectUri: string;
  // The username of the Clashfinder account of the admin.
  clashfinderUsername: string;
  // The private key of the Clashfinder account. Do not send it to Clashfinder.
  // Each export request gets a public key that the application makes from this key.
  clashfinderPrivateKey: string;
  // An email address or a web address in the User-Agent of each MusicBrainz request.
  // MusicBrainz uses it to contact the operator of a client that causes problems.
  musicbrainzContact: string;
  // The setlist.fm API key. Do not give it to a different person (setlist.fm API terms).
  setlistFmApiKey: string;
  prediction: PredictionSettings;
}

// The numbers of the song prediction method (issue #12).
export interface PredictionSettings {
  // The application uses the shows of this number of months before the calculation.
  lookBackMonths: number;
  // The weight of a show halves for each period of this number of months of age.
  halfLifeMonths: number;
  // The maximum number of predicted songs of an artist.
  songCount: number;
  // A result stays valid for this number of months after its calculation.
  validMonths: number;
  // The maximum number of setlist.fm pages for one artist. Each page has 20 setlists.
  setlistPages: number;
  // The maximum number of Spotify track searches for one artist. Each search
  // uses Spotify quota, so a song list with few Spotify recordings stops here.
  spotifySearches: number;
}

export const defaultPredictionSettings: PredictionSettings = {
  lookBackMonths: 18,
  halfLifeMonths: 6,
  songCount: 10,
  validMonths: 6,
  setlistPages: 10,
  spotifySearches: 20,
};
