import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setlistFmSetlistsUrl, setlistFmVenueSetlistsUrl } from "../../src/setlist-fm.ts";
import type { RecordedResponse } from "./fake-http-client.ts";

export { setlistFmSetlistsUrl, setlistFmVenueSetlistsUrl };

// Recorded setlist.fm responses. test/fixtures/setlist-fm/README.md tells how they were recorded.
const fixtures = join(import.meta.dirname, "..", "fixtures", "setlist-fm");

// The time of the recording. A test that calculates predicted songs sets the
// fake clock to this time, so that the recorded pages cover the look-back period.
export const setlistFmRecordedAt = new Date("2026-11-19T13:13:42Z");

export function setlistsFileName(musicbrainzId: string, page: number): string {
  return `setlists-${musicbrainzId}-${page}.json`;
}

// The file of the setlist search for one venue and one date, for example "venue-3bd634d0-2026-10-11.json".
export function venueSetlistsFileName(venueId: string, date: Date): string {
  return `venue-${venueId}-${date.toISOString().slice(0, 10)}.json`;
}

// Each file has the status and the body of the response.
function recorded(file: string): RecordedResponse {
  const { status, body } = JSON.parse(readFileSync(join(fixtures, file), "utf8")) as { status: number; body: unknown };
  return { status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function setlistsResponse(musicbrainzId: string, page: number): RecordedResponse {
  return recorded(setlistsFileName(musicbrainzId, page));
}

export function venueSetlistsResponse(venueId: string, date: Date): RecordedResponse {
  return recorded(venueSetlistsFileName(venueId, date));
}

// The venues and dates with a recorded setlist search.
export function recordedVenueDates(): { venueId: string; date: Date }[] {
  return readdirSync(fixtures).flatMap((file) => {
    const match = /^venue-(.+)-(\d{4}-\d{2}-\d{2})\.json$/.exec(file);
    return match === null ? [] : [{ venueId: match[1]!, date: new Date(`${match[2]}T00:00:00Z`) }];
  });
}

// Gives the fake HTTP client each recorded setlist page and each recorded venue-and-date search.
export function respondWithRecordedSetlistFm(respondTo: (method: string, url: string, response: RecordedResponse) => void): void {
  for (const file of readdirSync(fixtures)) {
    const match = /^setlists-(.+)-(\d+)\.json$/.exec(file);
    if (match === null) continue;
    const page = Number(match[2]);
    respondTo("GET", setlistFmSetlistsUrl(match[1]!, page), setlistsResponse(match[1]!, page));
  }
  for (const { venueId, date } of recordedVenueDates()) {
    respondTo("GET", setlistFmVenueSetlistsUrl(venueId, date), venueSetlistsResponse(venueId, date));
  }
}

// Status 429. The setlist.fm documentation does not give the response to a
// request over the rate limit, so this response is not a recording. It has no Retry-After value.
export const setlistFmRateLimitResponse: RecordedResponse = {
  status: 429,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: 429, status: "Too Many Requests", message: "Too Many Requests" }),
};
