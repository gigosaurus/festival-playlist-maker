import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { setlistFmSetlistsUrl } from "../../src/setlist-fm.ts";
import type { RecordedResponse } from "./fake-http-client.ts";

export { setlistFmSetlistsUrl };

// Recorded setlist.fm responses. test/fixtures/setlist-fm/README.md tells how they were recorded.
const fixtures = join(import.meta.dirname, "..", "fixtures", "setlist-fm");

// The time of the recording. A test that calculates predicted songs sets the
// fake clock to this time, so that the recorded pages cover the look-back period.
export const setlistFmRecordedAt = new Date("2026-11-19T13:13:42Z");

export function setlistsFileName(musicbrainzId: string, page: number): string {
  return `setlists-${musicbrainzId}-${page}.json`;
}

// Each file has the status and the body of the response.
export function setlistsResponse(musicbrainzId: string, page: number): RecordedResponse {
  const { status, body } = JSON.parse(readFileSync(join(fixtures, setlistsFileName(musicbrainzId, page)), "utf8")) as {
    status: number;
    body: unknown;
  };
  return { status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

// Gives the fake HTTP client each recorded setlist page.
export function respondWithRecordedSetlistFm(respondTo: (method: string, url: string, response: RecordedResponse) => void): void {
  for (const file of readdirSync(fixtures)) {
    const match = /^setlists-(.+)-(\d+)\.json$/.exec(file);
    if (match === null) continue;
    const page = Number(match[2]);
    respondTo("GET", setlistFmSetlistsUrl(match[1]!, page), setlistsResponse(match[1]!, page));
  }
}

// Status 429. The setlist.fm documentation does not give the response to a
// request over the rate limit, so this response is not a recording. It has no Retry-After value.
export const setlistFmRateLimitResponse: RecordedResponse = {
  status: 429,
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: 429, status: "Too Many Requests", message: "Too Many Requests" }),
};
