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

// The numbers of the song prediction method (issues #12, #13 and #14).
export interface PredictionSettings {
  // The application uses the shows of this number of months before the calculation.
  lookBackMonths: number;
  // When an artist has fewer than this number of shows in the look-back period,
  // the application uses the next period in `longLookBackMonths`.
  fewShows: number;
  // The longer look-back periods, in months, from the shortest to the longest.
  // A result from a longer period gets the long look-back mark.
  longLookBackMonths: number[];
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
  // A show is a festival set when MusicBrainz has a festival of the artist on the
  // date, or when setlist.fm has this number of artists, or more, at the same
  // venue on the same date. Use a number of 20 or less,
  // because the application counts the artists on one page of 20 setlists.
  festivalSetArtists: number;
  // The weight of a festival set is this number of times the weight of a different show.
  festivalSetWeight: number;
  // All the shows of one tour together count a maximum of this number of shows.
  // Festival sets are not in this limit, because setlist.fm often gives a tour
  // name to the festival sets of a summer.
  tourShowLimit: number;
  // setlist.fm users add setlists after a show. A result "not a festival set"
  // from fewer than this number of days after the date is checked again.
  festivalSetCheckDays: number;
  // A show is album-focused when more than `albumFocusedShare` of its songs come
  // from one album that was released in the `albumFocusedMonths` months before the show.
  albumFocusedShare: number;
  albumFocusedMonths: number;
  // The weight of an album-focused show is this number of times the weight of a different show.
  albumFocusedWeight: number;
  // A cover is kept only when it is one of this number of songs with the highest score,
  // and Spotify has a recording of it by the performing artist.
  coverTopSongs: number;
}

export const defaultPredictionSettings: PredictionSettings = {
  lookBackMonths: 18,
  fewShows: 5,
  longLookBackMonths: [36, 60],
  halfLifeMonths: 6,
  songCount: 10,
  validMonths: 6,
  setlistPages: 10,
  spotifySearches: 20,
  festivalSetArtists: 10,
  festivalSetWeight: 2,
  tourShowLimit: 3,
  festivalSetCheckDays: 30,
  albumFocusedShare: 0.5,
  albumFocusedMonths: 12,
  albumFocusedWeight: 0.1,
  coverTopSongs: 10,
};
