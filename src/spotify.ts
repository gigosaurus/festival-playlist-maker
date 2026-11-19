import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { RequestLimitError, SpotifyQuotaError, spotifyApiOrigin, type HttpClient } from "./http-client.ts";
import { spotifyArtistAddressPattern } from "./musicbrainz.ts";
import type { Settings } from "./settings.ts";
import { spotifyTokenUrl } from "./spotify-log-in.ts";

// The Spotify Web API requests for artists. The application has no client
// secret (ADR-0001), so it uses an access token of the admin. It gets the access
// token with the refresh token that the log in stored.

export interface SpotifyArtist {
  id: string;
  name: string;
}

export type SpotifyArtistResult =
  | { outcome: "found"; artist: SpotifyArtist }
  | { outcome: "not-found" }
  | { outcome: "failed"; cause: string };

export type SpotifySearchResult = { outcome: "found"; artists: SpotifyArtist[] } | { outcome: "failed"; cause: string };

export interface SpotifyTrack {
  id: string;
  name: string;
  artistIds: string[];
}

// `retryAt` is set when a rate limit stopped the request. A quota error has no
// `retryAt`, because Spotify does not tell when the quota is available again.
export type SpotifyTrackSearchResult = { outcome: "found"; tracks: SpotifyTrack[] } | { outcome: "failed"; cause: string; retryAt?: Date };

export interface Spotify {
  artist(id: string): Promise<SpotifyArtistResult>;
  searchArtists(name: string): Promise<SpotifySearchResult>;
  // A track search with a Spotify search query, for example `track:"Throne" artist:"Bring Me The Horizon"`.
  searchTracks(query: string): Promise<SpotifyTrackSearchResult>;
}

// The number of artists in a search result. Development Mode permits a maximum of 10.
export const spotifySearchLimit = 5;

// The number of tracks in a search result: the Development Mode maximum.
export const spotifyTrackSearchLimit = 10;

export function spotifyTrackSearchUrl(query: string): string {
  const url = new URL(`${spotifyApiOrigin}/v1/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(spotifyTrackSearchLimit));
  return url.href;
}

// The search query for one song of an artist. A field filter cannot contain a double quotation mark.
export function songQuery(song: string, artist: string): string {
  return `track:"${song.replace(/"/g, " ")}" artist:"${artist.replace(/"/g, " ")}"`;
}

// The search query for the tracks of an artist: the Spotify search fallback (ADR-0002).
export function artistTracksQuery(artist: string): string {
  return `artist:"${artist.replace(/"/g, " ")}"`;
}

// The page of the track in Spotify.
export function spotifyTrackAddress(id: string): string {
  return `https://open.spotify.com/track/${encodeURIComponent(id)}`;
}

// The Spotify embed player for one track.
export function spotifyTrackEmbedAddress(id: string): string {
  return `https://open.spotify.com/embed/track/${encodeURIComponent(id)}`;
}

export function spotifyArtistUrl(id: string): string {
  return `${spotifyApiOrigin}/v1/artists/${encodeURIComponent(id)}`;
}

export function spotifySearchUrl(name: string): string {
  const url = new URL(`${spotifyApiOrigin}/v1/search`);
  url.searchParams.set("q", name);
  url.searchParams.set("type", "artist");
  url.searchParams.set("limit", String(spotifySearchLimit));
  return url.href;
}

// The page of the artist in Spotify.
export function spotifyArtistAddress(id: string): string {
  return `https://open.spotify.com/artist/${encodeURIComponent(id)}`;
}

const spotifyIdPattern = /^[0-9A-Za-z]{22}$/;

// The Spotify artist ID in a text that the admin entered: the address of the
// artist page, a Spotify URI ("spotify:artist:…") or the ID. Undefined when the
// text has no Spotify artist ID.
export function readSpotifyArtistId(text: string): string | undefined {
  const value = text.trim();
  if (spotifyIdPattern.test(value)) return value;
  const uri = /^spotify:artist:([0-9A-Za-z]{22})$/.exec(value);
  if (uri) return uri[1];
  return spotifyArtistAddressPattern.exec(value)?.[1];
}

// An access token stays valid for the time in "expires_in". The application gets
// a new token this long before the end, so that a token does not expire during a request.
const tokenMargin = 60_000;

export function createSpotify(httpClient: HttpClient, database: Database, clock: Clock, settings: Settings): Spotify {
  let token: { value: string; expiresAt: number } | undefined;

  // Sends a GET request with the access token of the admin. After status 401,
  // it gets a new access token and sends the request again, one time.
  async function get(url: string): Promise<Response | Failure> {
    for (let attempt = 1; ; attempt++) {
      if (token === undefined || token.expiresAt <= clock.now().getTime()) {
        const result = await refreshAccessToken();
        if (result instanceof Failure) return result;
        token = result;
      }
      let response: Response;
      try {
        response = await httpClient.send(new Request(url, { headers: { authorization: `Bearer ${token.value}` } }));
      } catch (error) {
        if (error instanceof SpotifyQuotaError) return new Failure(error.message);
        if (error instanceof RequestLimitError) return new Failure(error.message, error.retryAt);
        return new Failure(`The application could not connect to Spotify: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (response.status === 401 && attempt === 1) {
        token = undefined;
        continue;
      }
      return response;
    }
  }

  async function refreshAccessToken(): Promise<{ value: string; expiresAt: number } | Failure> {
    const admin = database.prepare("SELECT id, refresh_token FROM user WHERE spotify_user_id = ?").get(settings.adminSpotifyUserId) as
      | { id: number; refresh_token: string }
      | undefined;
    if (admin === undefined) return new Failure("The admin has not logged in, so the application has no Spotify access token. Log in as the admin.");
    let response: Response;
    try {
      response = await httpClient.send(
        new Request(spotifyTokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: admin.refresh_token, client_id: settings.spotifyClientId }),
        }),
      );
    } catch (error) {
      return new Failure(`The application could not connect to Spotify: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Spotify gives status 400 with "invalid_grant" when the refresh token is not valid,
    // for example after the admin removed the access of the application.
    if (response.status === 400) {
      return new Failure("Spotify refused the refresh token of the admin. Log out, then log in again as the admin.");
    }
    if (!response.ok) return new Failure(`Spotify refused the access token request (status ${response.status}).`);
    const body = (await response.json().catch(() => undefined)) as
      | { access_token?: unknown; expires_in?: unknown; refresh_token?: unknown }
      | undefined;
    if (typeof body?.access_token !== "string") return new Failure("The Spotify token response has no access token.");
    // With PKCE, Spotify can give a new refresh token. Then the old one is not valid.
    if (typeof body.refresh_token === "string" && body.refresh_token !== admin.refresh_token) {
      database.prepare("UPDATE user SET refresh_token = ? WHERE id = ?").run(body.refresh_token, admin.id);
    }
    const lifetime = typeof body.expires_in === "number" ? body.expires_in * 1000 : 3_600_000;
    return { value: body.access_token, expiresAt: clock.now().getTime() + lifetime - tokenMargin };
  }

  return {
    async artist(id) {
      // Spotify gives status 400 for an ID with an incorrect format.
      if (!spotifyIdPattern.test(id)) return { outcome: "not-found" };
      const response = await get(spotifyArtistUrl(id));
      if (response instanceof Failure) return { outcome: "failed", cause: response.cause };
      if (response.status === 404 || response.status === 400) return { outcome: "not-found" };
      if (!response.ok) return { outcome: "failed", cause: await describe(response) };
      const artist = readArtist(await response.json().catch(() => undefined));
      if (artist === undefined) return { outcome: "failed", cause: "The Spotify response has no artist ID or name. The Spotify API possibly changed." };
      return { outcome: "found", artist };
    },

    async searchArtists(name) {
      const response = await get(spotifySearchUrl(name));
      if (response instanceof Failure) return { outcome: "failed", cause: response.cause };
      if (!response.ok) return { outcome: "failed", cause: await describe(response) };
      const body = (await response.json().catch(() => undefined)) as { artists?: { items?: unknown } } | undefined;
      const items = body?.artists?.items;
      if (!Array.isArray(items)) {
        return { outcome: "failed", cause: 'The Spotify response has no "artists" list. The Spotify API possibly changed.' };
      }
      return { outcome: "found", artists: items.flatMap((item) => readArtist(item) ?? []) };
    },

    async searchTracks(query) {
      const response = await get(spotifyTrackSearchUrl(query));
      if (response instanceof Failure) {
        return response.retryAt === undefined
          ? { outcome: "failed", cause: response.cause }
          : { outcome: "failed", cause: response.cause, retryAt: response.retryAt };
      }
      if (!response.ok) return { outcome: "failed", cause: await describe(response) };
      const body = (await response.json().catch(() => undefined)) as { tracks?: { items?: unknown } } | undefined;
      const items = body?.tracks?.items;
      if (!Array.isArray(items)) {
        return { outcome: "failed", cause: 'The Spotify response has no "tracks" list. The Spotify API possibly changed.' };
      }
      return { outcome: "found", tracks: items.flatMap((item) => readTrack(item) ?? []) };
    },
  };
}

function readTrack(value: unknown): SpotifyTrack | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { id, name, artists } = value as { id?: unknown; name?: unknown; artists?: unknown };
  if (typeof id !== "string" || !spotifyIdPattern.test(id) || typeof name !== "string" || !Array.isArray(artists)) return undefined;
  const artistIds = artists.flatMap((artist) => {
    const artistId = typeof artist === "object" && artist !== null ? (artist as { id?: unknown }).id : undefined;
    return typeof artistId === "string" ? [artistId] : [];
  });
  return { id, name, artistIds };
}

function readArtist(value: unknown): SpotifyArtist | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { id, name } = value as { id?: unknown; name?: unknown };
  if (typeof id !== "string" || !spotifyIdPattern.test(id) || typeof name !== "string" || name.trim() === "") return undefined;
  return { id, name: name.replace(/\s+/g, " ").trim() };
}

// A failure before Spotify gave a usable response.
class Failure {
  readonly cause: string;
  // The time after which a new request is possible, after a rate limit.
  readonly retryAt: Date | undefined;

  constructor(cause: string, retryAt?: Date) {
    this.cause = cause;
    this.retryAt = retryAt;
  }
}

// The Spotify error object: { "error": { "status": 403, "message": "…" } }.
async function describe(response: Response): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: unknown } };
    if (typeof body.error?.message === "string") detail = `: ${body.error.message.slice(0, 200)}`;
  } catch {
    detail = "";
  }
  return `Spotify refused the request (status ${response.status})${detail}.`;
}
