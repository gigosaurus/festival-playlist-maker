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

interface AccessToken {
  value: string;
  expiresAt: number;
}

// The account whose access token a request uses: the stored user, and the text
// that tells the person what to do when Spotify refuses the refresh token.
interface TokenAccount {
  id: number;
  refreshToken: string;
  refusedText: string;
}

// Sends Spotify Web API requests with the access token of one account. It keeps
// the access token of each account, and gets a new one with the stored refresh token.
function createAuthorisedSender(httpClient: HttpClient, database: Database, clock: Clock, settings: Settings) {
  const tokens = new Map<number, AccessToken>();

  // Sends the request with the access token of the account. After status 401,
  // it gets a new access token and sends the request again, one time.
  // `request` makes a new request for each attempt, because a request body can be read only once.
  return async function send(account: TokenAccount | Failure, request: (token: string) => Request): Promise<Response | Failure> {
    if (account instanceof Failure) return account;
    for (let attempt = 1; ; attempt++) {
      let token = tokens.get(account.id);
      if (token === undefined || token.expiresAt <= clock.now().getTime()) {
        const result = await refreshAccessToken(account);
        if (result instanceof Failure) return result;
        token = result;
        tokens.set(account.id, token);
      }
      let response: Response;
      try {
        response = await httpClient.send(request(token.value));
      } catch (error) {
        if (error instanceof SpotifyQuotaError) return new Failure(error.message);
        if (error instanceof RequestLimitError) return new Failure(error.message, error.retryAt);
        return new Failure(`The application could not connect to Spotify: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (response.status === 401 && attempt === 1) {
        tokens.delete(account.id);
        continue;
      }
      return response;
    }
  };

  async function refreshAccessToken(account: TokenAccount): Promise<AccessToken | Failure> {
    // A different request possibly got a new refresh token since the account was read.
    const stored = database.prepare("SELECT refresh_token FROM user WHERE id = ?").get(account.id) as { refresh_token: string } | undefined;
    const refreshToken = stored?.refresh_token ?? account.refreshToken;
    let response: Response;
    try {
      response = await httpClient.send(
        new Request(spotifyTokenUrl, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: settings.spotifyClientId }),
        }),
      );
    } catch (error) {
      return new Failure(`The application could not connect to Spotify: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Spotify gives status 400 with "invalid_grant" when the refresh token is not valid,
    // for example after the person removed the access of the application.
    if (response.status === 400) return new Failure(account.refusedText);
    if (!response.ok) return new Failure(`Spotify refused the access token request (status ${response.status}).`);
    const body = (await response.json().catch(() => undefined)) as
      | { access_token?: unknown; expires_in?: unknown; refresh_token?: unknown }
      | undefined;
    if (typeof body?.access_token !== "string") return new Failure("The Spotify token response has no access token.");
    // With PKCE, Spotify can give a new refresh token. Then the old one is not valid.
    if (typeof body.refresh_token === "string" && body.refresh_token !== refreshToken) {
      database.prepare("UPDATE user SET refresh_token = ? WHERE id = ?").run(body.refresh_token, account.id);
    }
    const lifetime = typeof body.expires_in === "number" ? body.expires_in * 1000 : 3_600_000;
    return { value: body.access_token, expiresAt: clock.now().getTime() + lifetime - tokenMargin };
  }
}

export function createSpotify(httpClient: HttpClient, database: Database, clock: Clock, settings: Settings): Spotify {
  const send = createAuthorisedSender(httpClient, database, clock, settings);

  // The requests for artists and tracks use the access token of the admin.
  function adminAccount(): TokenAccount | Failure {
    const admin = database.prepare("SELECT id, refresh_token FROM user WHERE spotify_user_id = ?").get(settings.adminSpotifyUserId) as
      | { id: number; refresh_token: string }
      | undefined;
    if (admin === undefined) return new Failure("The admin has not logged in, so the application has no Spotify access token. Log in as the admin.");
    return {
      id: admin.id,
      refreshToken: admin.refresh_token,
      refusedText: "Spotify refused the refresh token of the admin. Log out, then log in again as the admin.",
    };
  }

  function get(url: string): Promise<Response | Failure> {
    return send(adminAccount(), (token) => new Request(url, { headers: { authorization: `Bearer ${token}` } }));
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

// The Spotify playlist of a user (#15).
export interface SpotifyPlaylist {
  id: string;
  // The page of the playlist in Spotify.
  address: string;
}

// `retryAt` is set when a rate limit stopped the request.
export type SpotifyPlaylistFailure = { outcome: "failed"; cause: string; retryAt?: Date };

export interface SpotifyPlaylists {
  // Makes a private playlist in the Spotify account of the user.
  make(userId: number, details: { name: string; description: string }): Promise<{ outcome: "made"; playlist: SpotifyPlaylist } | SpotifyPlaylistFailure>;
  // Replaces all of the items of the playlist with a maximum of `spotifyPlaylistItemLimit` tracks.
  replaceItems(userId: number, playlistId: string, trackIds: string[]): Promise<{ outcome: "done" } | SpotifyPlaylistFailure>;
  // Adds a maximum of `spotifyPlaylistItemLimit` tracks to the end of the playlist.
  addItems(userId: number, playlistId: string, trackIds: string[]): Promise<{ outcome: "done" } | SpotifyPlaylistFailure>;
}

// The maximum number of items in one request that adds or replaces playlist items.
export const spotifyPlaylistItemLimit = 100;

// Development Mode removed "POST /users/{user_id}/playlists" and the "/tracks"
// playlist endpoints in February 2026. These are the replacements.
export const spotifyMyPlaylistsUrl = `${spotifyApiOrigin}/v1/me/playlists`;

export function spotifyPlaylistItemsUrl(playlistId: string): string {
  return `${spotifyApiOrigin}/v1/playlists/${encodeURIComponent(playlistId)}/items`;
}

// The page of the playlist in Spotify.
export function spotifyPlaylistAddress(id: string): string {
  return `https://open.spotify.com/playlist/${encodeURIComponent(id)}`;
}

// The requests for playlists use the access token of the user, because the playlist is in the account of the user.
export function createSpotifyPlaylists(httpClient: HttpClient, database: Database, clock: Clock, settings: Settings): SpotifyPlaylists {
  const send = createAuthorisedSender(httpClient, database, clock, settings);

  function userAccount(userId: number): TokenAccount | Failure {
    const user = database.prepare("SELECT id, refresh_token FROM user WHERE id = ?").get(userId) as
      | { id: number; refresh_token: string }
      | undefined;
    if (user === undefined) return new Failure("The application has no Spotify log in for this user. Log out, then log in again.");
    return { id: user.id, refreshToken: user.refresh_token, refusedText: "Spotify refused your log in. Log out, then log in again." };
  }

  function sendJson(userId: number, method: string, url: string, body: unknown): Promise<Response | Failure> {
    return send(
      userAccount(userId),
      (token) =>
        new Request(url, {
          method,
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
    );
  }

  async function setItems(userId: number, method: "PUT" | "POST", playlistId: string, trackIds: string[]) {
    if (trackIds.length > spotifyPlaylistItemLimit) throw new Error(`One request can set a maximum of ${spotifyPlaylistItemLimit} items.`);
    const response = await sendJson(userId, method, spotifyPlaylistItemsUrl(playlistId), { uris: trackIds.map((id) => `spotify:track:${id}`) });
    if (response instanceof Failure) return failed(response);
    if (!response.ok) return { outcome: "failed" as const, cause: await describe(response) };
    return { outcome: "done" as const };
  }

  return {
    async make(userId, { name, description }) {
      const response = await sendJson(userId, "POST", spotifyMyPlaylistsUrl, { name, description, public: false });
      if (response instanceof Failure) return failed(response);
      if (!response.ok) return { outcome: "failed", cause: await describe(response) };
      const body = (await response.json().catch(() => undefined)) as { id?: unknown } | undefined;
      if (typeof body?.id !== "string" || !spotifyIdPattern.test(body.id)) {
        return { outcome: "failed", cause: "The Spotify response has no playlist ID. The Spotify API possibly changed." };
      }
      // The address comes from the ID, so that a link on a page cannot go to a different website.
      return { outcome: "made", playlist: { id: body.id, address: spotifyPlaylistAddress(body.id) } };
    },
    replaceItems: (userId, playlistId, trackIds) => setItems(userId, "PUT", playlistId, trackIds),
    addItems: (userId, playlistId, trackIds) => setItems(userId, "POST", playlistId, trackIds),
  };
}

function failed(failure: Failure): SpotifyPlaylistFailure {
  return failure.retryAt === undefined
    ? { outcome: "failed", cause: failure.cause }
    : { outcome: "failed", cause: failure.cause, retryAt: failure.retryAt };
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
