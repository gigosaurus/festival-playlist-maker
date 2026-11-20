import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { eventsPerPage, genreListUrl, musicbrainzEventsUrl, musicbrainzLinksUrl, musicbrainzSearchUrl } from "../../src/musicbrainz.ts";

export { genreListUrl, musicbrainzEventsUrl, musicbrainzLinksUrl, musicbrainzSearchUrl };
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

// The file name of the recorded lookup of an artist with its links.
export function linksFileName(musicbrainzId: string): string {
  return `links-${musicbrainzId}.json`;
}

// The file name of a recorded page of the events of an artist. The first page is 1.
export function eventsFileName(musicbrainzId: string, page: number): string {
  return `events-${musicbrainzId}-${page}.json`;
}

// A recorded page of the events of an artist.
export function eventsResponse(musicbrainzId: string, page: number): RecordedResponse {
  return recorded(eventsFileName(musicbrainzId, page), "application/json; charset=utf-8");
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

// The recorded lookup of an artist with its links.
export function linksResponse(musicbrainzId: string): RecordedResponse {
  return recorded(linksFileName(musicbrainzId), "application/json; charset=utf-8");
}

// The MusicBrainz artists that have a recorded lookup with links: the proposed
// artist of each Download 2027 name, and two artists with no Spotify link.
export const musicbrainzIds = {
  blink182: "0743b15a-3c32-48c8-ad58-cb325350befa",
  bringMeTheHorizon: "074e3847-f67f-49f9-81f1-8c8cea147e8e",
  bringMeTheHorizonUk: "aa6d8208-d68b-4b7a-83ea-7faaebccf12b",
  evanescence: "f4a31f0a-51dd-4fa7-986d-3095c40c5ed9",
  faithNoMore: "b15ebd71-a252-417d-9e1c-3e6863da68f8",
  ghostSweden: "2bcf2e02-5bc3-4c76-bf76-41126cb11444",
  ghostJapan: "97ea6a8e-2011-45f0-895e-8bb082b1aa64",
  motleyCrue: "26f07661-e115-471d-a930-206f5c89d17c",
  parkwayDrive: "a436dd02-0549-4c91-b608-df451217fdeb",
  pierceTheVeil: "8ed919fb-eaee-45a1-ba99-b3ede9ca5f1d",
  theProdigy: "4a4ee089-93b1-4470-af9a-6ff575d32704",
  turnstile: "7b748dac-f5ce-45a7-9b95-c1d8b5b013ed",
};

// Gives the fake HTTP client the genre list, each recorded search and each recorded lookup.
export function respondWithRecordedMusicBrainz(respondTo: (method: string, url: string, response: RecordedResponse) => void): void {
  respondTo("GET", genreListUrl, genreListResponse());
  for (const text of recordedSearches) respondTo("GET", musicbrainzSearchUrl(text), searchResponse(text));
  for (const id of Object.values(musicbrainzIds)) respondTo("GET", musicbrainzLinksUrl(id), linksResponse(id));
  for (const file of readdirSync(fixtures)) {
    const match = /^events-(.+)-(\d+)\.json$/.exec(file);
    if (match === null) continue;
    const page = Number(match[2]);
    respondTo("GET", musicbrainzEventsUrl(match[1]!, (page - 1) * eventsPerPage), eventsResponse(match[1]!, page));
  }
}

// Status 503: MusicBrainz is busy, or the client sent too many requests. Recorded 18 November 2026.
export const busyResponse: RecordedResponse = {
  status: 503,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: '{"error": "The MusicBrainz web server is currently busy. Please try again later."}',
};
