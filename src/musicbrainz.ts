import { musicbrainzOrigin, RequestLimitError, type HttpClient } from "./http-client.ts";

// The MusicBrainz API: musicbrainz.org/doc/MusicBrainz_API. The HTTP client adds
// the User-Agent and keeps the limit of 1 request each second (ADR-0003).

// The maximum number of possible artists for one search.
export const maximumArtists = 5;

// MusicBrainz gives status 503 when it is busy or when a client sends too many
// requests. The module then sends the request again, a maximum of 2 times.
const attempts = 3;

const musicbrainzIdPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// The search for a lineup name or for a text that the admin entered. A text
// that contains a MusicBrainz ID, for example the address of an artist page,
// finds that artist.
export function musicbrainzSearchUrl(text: string): string {
  const id = musicbrainzIdPattern.exec(text)?.[0];
  const query = id === undefined ? escapeQuery(text.toLowerCase()) : `arid:${id.toLowerCase()}`;
  const url = new URL(`${musicbrainzOrigin}/ws/2/artist`);
  url.searchParams.set("query", query);
  url.searchParams.set("limit", String(maximumArtists));
  url.searchParams.set("fmt", "json");
  return url.href;
}

// The list of all MusicBrainz genres, one on each line. A search result has the
// tags of each artist. Only the tags in this list are genres.
export const genreListUrl = `${musicbrainzOrigin}/ws/2/genre/all?fmt=txt`;

export function musicbrainzArtistAddress(id: string): string {
  return `${musicbrainzOrigin}/artist/${encodeURIComponent(id)}`;
}

export interface MusicBrainzArtist {
  id: string;
  name: string;
  // The text that MusicBrainz gives to tell artists with the same name apart.
  disambiguation?: string;
  // "Person", "Group", "Orchestra", "Choir", "Character" or "Other".
  type?: string;
  // An ISO 3166-1 code, for example "GB".
  country?: string;
  // The area name when there is no country code, for example "Europe".
  area?: string;
  // The life span. For a person, this is the birth and the death.
  begin?: string;
  end?: string;
  ended: boolean;
  // The genres, the genre with the most votes first.
  genres: string[];
  // The search score from 0 to 100.
  score: number;
  // The total of the positive votes for all tags. An artist that many people
  // know usually has more votes.
  votes: number;
  // Other names of the artist, for example "BMTH".
  aliases: string[];
}

export type ArtistSearchResult = { outcome: "found"; artists: MusicBrainzArtist[] } | { outcome: "failed"; cause: string };

export interface MusicBrainz {
  searchArtists(text: string): Promise<ArtistSearchResult>;
}

export function createMusicBrainz(httpClient: HttpClient): MusicBrainz {
  let genres: Set<string> | undefined;

  return {
    async searchArtists(text) {
      if (genres === undefined) {
        const result = await getGenres(httpClient);
        if (result instanceof Failure) return { outcome: "failed", cause: result.cause };
        genres = result;
      }
      const response = await send(httpClient, musicbrainzSearchUrl(text), "application/json");
      if (response instanceof Failure) return { outcome: "failed", cause: response.cause };
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        return { outcome: "failed", cause: "The MusicBrainz response is not valid JSON. The MusicBrainz API possibly changed." };
      }
      if (!isRecord(body) || !Array.isArray(body.artists)) {
        return { outcome: "failed", cause: 'The MusicBrainz response has no "artists" list. The MusicBrainz API possibly changed.' };
      }
      const known = genres;
      return { outcome: "found", artists: body.artists.flatMap((artist) => readArtist(artist, known) ?? []) };
    },
  };
}

async function getGenres(httpClient: HttpClient): Promise<Set<string> | Failure> {
  const response = await send(httpClient, genreListUrl, "text/plain");
  if (response instanceof Failure) return response;
  const genres = new Set(
    (await response.text())
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean),
  );
  if (genres.size === 0) return new Failure("The MusicBrainz genre list is empty. The MusicBrainz API possibly changed.");
  return genres;
}

function readArtist(value: unknown, knownGenres: Set<string>): MusicBrainzArtist | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || !musicbrainzIdPattern.test(value.id)) return undefined;
  const name = text(value.name);
  if (name === undefined) return undefined;
  const lifeSpan = isRecord(value["life-span"]) ? value["life-span"] : {};
  const tags = Array.isArray(value.tags) ? value.tags.filter(isRecord) : [];
  const genres = tags
    .map((tag) => ({ name: text(tag.name)?.toLowerCase(), count: typeof tag.count === "number" ? tag.count : 0 }))
    .filter((tag): tag is { name: string; count: number } => tag.name !== undefined && tag.count > 0 && knownGenres.has(tag.name))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .map((tag) => tag.name);
  const aliases = Array.isArray(value.aliases)
    ? value.aliases.flatMap((alias) => (isRecord(alias) ? (text(alias.name) ?? []) : []))
    : [];
  const artist: MusicBrainzArtist = {
    id: value.id.toLowerCase(),
    name,
    ended: lifeSpan.ended === true,
    genres: [...new Set(genres)],
    score: typeof value.score === "number" ? value.score : 0,
    votes: tags.reduce((total, tag) => total + (typeof tag.count === "number" && tag.count > 0 ? tag.count : 0), 0),
    aliases: [...new Set(aliases)],
  };
  const optional = {
    disambiguation: text(value.disambiguation),
    type: text(value.type),
    country: typeof value.country === "string" && /^[A-Z]{2}$/.test(value.country) ? value.country : undefined,
    area: isRecord(value.area) ? text(value.area.name) : undefined,
    begin: partialDate(lifeSpan.begin),
    end: partialDate(lifeSpan.end),
  };
  for (const [key, field] of Object.entries(optional)) {
    if (field !== undefined) (artist as unknown as Record<string, unknown>)[key] = field;
  }
  return artist;
}

// Lucene query syntax: a backslash before each special character makes it usual text.
function escapeQuery(text: string): string {
  return text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

// A failure before MusicBrainz gave a usable response.
class Failure {
  readonly cause: string;

  constructor(cause: string) {
    this.cause = cause;
  }
}

async function send(httpClient: HttpClient, url: string, accept: string): Promise<Response | Failure> {
  for (let attempt = 1; ; attempt++) {
    let response: Response;
    try {
      response = await httpClient.send(new Request(url, { headers: { accept } }));
    } catch (error) {
      if (error instanceof RequestLimitError) return new Failure(error.message);
      return new Failure(`The application could not connect to MusicBrainz: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (response.ok) return response;
    if (response.status === 503 && attempt < attempts) continue;
    if (response.status === 503) {
      return new Failure(`MusicBrainz was busy and refused the request ${attempts} times (status 503). Try again in some minutes.`);
    }
    let detail = "";
    try {
      const body: unknown = JSON.parse(await response.text());
      if (isRecord(body) && typeof body.error === "string") detail = `: ${body.error.slice(0, 200)}`;
    } catch {
      detail = "";
    }
    return new Failure(`MusicBrainz refused the request (status ${response.status})${detail}.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Trimmed text with each run of white space as one space, or undefined when it is empty.
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.replace(/\s+/g, " ").trim();
  return result === "" ? undefined : result;
}

// MusicBrainz gives a year, a year and a month, or a full date: "2004", "2004-03", "2004-03-01".
function partialDate(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(value) ? value : undefined;
}
