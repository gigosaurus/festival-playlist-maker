import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spotifyArtistUrl, spotifySearchUrl, spotifyTrackSearchUrl, type SpotifyArtist } from "../../src/spotify.ts";
import { spotifyTokenUrl } from "../../src/spotify-log-in.ts";
import type { RecordedResponse } from "./fake-http-client.ts";
import { spotifyTokenResponse } from "./test-settings.ts";

import { musicbrainzIds } from "./musicbrainz.ts";

export { spotifyArtistUrl, spotifySearchUrl, spotifyTokenUrl, spotifyTrackSearchUrl };

// Recorded Spotify responses. test/fixtures/spotify/README.md tells how they were recorded.
const fixtures = join(import.meta.dirname, "..", "fixtures", "spotify");

// The Spotify artist IDs of the MusicBrainz Spotify links in test/fixtures/musicbrainz/links-*.json.
export const spotifyIds = {
  blink182: "6FBDaR13swtiWwGhX1WQsP",
  bringMeTheHorizon: "1Ffb6ejR6Fe5IamqA5oRUF",
  evanescence: "5nGIFgo0shDenQYSE0Sn7c",
  faithNoMore: "6GbCJZrI318Ybm8mY36Of5",
  ghostSweden: "1Qp56T7n950O3EGMsSl81D",
  motleyCrue: "0cc6vw3VN8YlIcvr1v7tBL",
  parkwayDrive: "159qqlGwzE04xyqpfAwRLo",
  pierceTheVeil: "4iJLPqClelZOBCBifm8Fzv",
  theProdigy: "4k1ELeJKT1ISyDv8JivPpB",
  turnstile: "2qnpHrOzdmOo1S4ox3j17x",
};

// The search texts with a recorded search: the names of the MusicBrainz artists
// with a recorded lookup and no Spotify link.
export const recordedSpotifySearches = ["Ghost", "Bring Me the Horizon UK"];

// The artists with recorded track searches (record-tracks.ts), and their Spotify
// artists. Bring Me the Horizon has setlists. The Japanese band "Ghost" has
// setlists only from 2009, so it gets the Spotify search fallback. Its Spotify
// artist is the Swedish band, as the search found it.
export const predictedArtists: { musicbrainzId: string; spotifyArtist: SpotifyArtist }[] = [
  { musicbrainzId: musicbrainzIds.bringMeTheHorizon, spotifyArtist: { id: spotifyIds.bringMeTheHorizon, name: "Bring Me The Horizon" } },
  { musicbrainzId: musicbrainzIds.ghostJapan, spotifyArtist: { id: spotifyIds.ghostSweden, name: "Ghost" } },
];

// The file name of a recorded track search, for example
// "tracks-track-throne-artist-bring-me-the-horizon.json".
export function trackSearchFileName(query: string): string {
  return `tracks-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
}

export function artistFileName(id: string): string {
  return `artist-${id}.json`;
}

export function searchFileName(text: string): string {
  return `search-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.json`;
}

function recorded(file: string): RecordedResponse {
  return { headers: { "content-type": "application/json; charset=utf-8" }, body: readFileSync(join(fixtures, file), "utf8") };
}

export function artistResponse(id: string): RecordedResponse {
  return recorded(artistFileName(id));
}

export function searchResponse(text: string): RecordedResponse {
  return recorded(searchFileName(text));
}

// The recorded track searches. Each file name comes from a query, but the query
// is not in the file name exactly, so this list gives each query.
export const recordedTrackSearches: string[] = JSON.parse(readFileSync(join(fixtures, "track-searches.json"), "utf8")) as string[];

export function trackSearchResponse(query: string): RecordedResponse {
  return recorded(trackSearchFileName(query));
}

// Gives the fake HTTP client an access token, each recorded artist, each recorded
// artist search and each recorded track search.
export function respondWithRecordedSpotify(respondTo: (method: string, url: string, response: RecordedResponse) => void): void {
  respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
  for (const id of Object.values(spotifyIds)) respondTo("GET", spotifyArtistUrl(id), artistResponse(id));
  for (const text of recordedSpotifySearches) respondTo("GET", spotifySearchUrl(text), searchResponse(text));
  for (const query of recordedTrackSearches) respondTo("GET", spotifyTrackSearchUrl(query), trackSearchResponse(query));
}

// Each track search file must have a query in track-searches.json.
export function unlistedTrackSearchFiles(): string[] {
  const listed = new Set(recordedTrackSearches.map(trackSearchFileName));
  return readdirSync(fixtures).filter((file) => file.startsWith("tracks-") && !listed.has(file));
}

// The Spotify error object for an ID that has no artist. From the Spotify Web API reference.
export const notFoundResponse: RecordedResponse = {
  status: 404,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ error: { status: 404, message: "Resource not found" } }),
};

// Status 429 with Retry-After: the rate limit of the rolling 30-second window.
export function rateLimitResponse(seconds: number): RecordedResponse {
  return {
    status: 429,
    headers: { "content-type": "application/json; charset=utf-8", "retry-after": String(seconds) },
    body: JSON.stringify({ error: { status: 429, message: "API rate limit exceeded" } }),
  };
}

// Status 429 with "reason": "QUOTA_EXCEEDED": the Development Mode quota is used up.
// developer.spotify.com/documentation/web-api/concepts/api-calls
export const quotaExceededResponse: RecordedResponse = {
  status: 429,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ error: { status: 429, message: "Quota exceeded", reason: "QUOTA_EXCEEDED" } }),
};
