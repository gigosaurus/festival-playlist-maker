import { readFileSync } from "node:fs";
import { join } from "node:path";
import { genreListUrl, musicbrainzSearchUrl } from "../../src/musicbrainz.ts";

export { genreListUrl, musicbrainzSearchUrl };
import type { RecordedResponse } from "./fake-http-client.ts";

// Recorded MusicBrainz responses. test/fixtures/musicbrainz/README.md tells how
// they were recorded.
const fixtures = join(import.meta.dirname, "..", "fixtures", "musicbrainz");

// The file name of the recorded search for a text, for example "search-bring-me-the-horizon.json".
export function fixtureFileName(text: string): string {
  const slug = text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `search-${slug || "symbols"}.json`;
}

function recorded(file: string, contentType: string): RecordedResponse {
  return { headers: { "content-type": contentType }, body: readFileSync(join(fixtures, file), "utf8") };
}

// The full genre list (2,226 genres).
export function genreListResponse(): RecordedResponse {
  return recorded("genres.txt", "text/plain; charset=utf-8");
}

// The recorded search for a text.
export function searchResponse(text: string): RecordedResponse {
  return recorded(fixtureFileName(text), "application/json; charset=utf-8");
}

// The names of the Download 2027 lineup (test/fixtures/clashfinder/event-download27.json).
export const download2027Names = [
  "???",
  "Blink 182",
  "Bring Me The Horizon",
  "Evanescence",
  "Faith No More",
  "Mötley Crüe",
  "Parkway Drive",
  "Pierce The Veil",
  "The Prodigy",
  "Turnstile",
];

// Each search text that has a recorded response.
export const recordedSearches = [...download2027Names, "Ghost", "BMTH"];

// Gives the fake HTTP client the genre list and each recorded search.
export function respondWithRecordedMusicBrainz(respondTo: (method: string, url: string, response: RecordedResponse) => void): void {
  respondTo("GET", genreListUrl, genreListResponse());
  for (const text of recordedSearches) respondTo("GET", musicbrainzSearchUrl(text), searchResponse(text));
}

// Status 503: MusicBrainz is busy, or the client sent too many requests. Recorded 18 November 2026.
export const busyResponse: RecordedResponse = {
  status: 503,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: '{"error": "The MusicBrainz web server is currently busy. Please try again later."}',
};
