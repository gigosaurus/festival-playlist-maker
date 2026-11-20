// Records setlist.fm responses for the predicted song tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/setlist-fm/record.ts [--venues | --pages] <output directory> <MusicBrainz ID>...
// For each artist, the script gets the setlist pages that a calculation at this
// time gets (lookBackShows): it stops after the first page with a show before the
// look-back period, after the last page, or after status 404. When the artist has
// fewer than 5 shows in the period, it gets more pages for a longer period (issue #14).
// Then it gets the setlist search for each venue and date that the calculation checks (issue #13).
// With --venues, the script does not get the setlist pages again. It gets only
// the venue-and-date searches for the recorded pages in the output directory, at
// the time of their recording (setlistFmRecordedAt). It does not get a search again when its file exists.
// With --pages, the script gets only the setlist pages, for tests that do not calculate.
// It reads SETLIST_FM_API_KEY. It waits 2 seconds between requests.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { countsForScore, lookBackShows } from "../../../src/predicted-songs.ts";
import { createSetlistFm, setlistFmSetlistsUrl, setlistFmVenueSetlistsUrl, type Show } from "../../../src/setlist-fm.ts";
import { defaultPredictionSettings } from "../../../src/settings.ts";
import { FakeHttpClient } from "../../support/fake-http-client.ts";
import { setlistFmRecordedAt, setlistsFileName, venueSetlistsFileName } from "../../support/setlist-fm.ts";

const venuesOnly = process.argv[2] === "--venues";
const pagesOnly = process.argv[2] === "--pages";
const [output, ...musicbrainzIds] = process.argv.slice(venuesOnly || pagesOnly ? 3 : 2);
const apiKey = process.env.SETLIST_FM_API_KEY?.trim();
if (output === undefined || musicbrainzIds.length === 0 || !apiKey) {
  console.error("Usage: node --env-file=.env test/fixtures/setlist-fm/record.ts [--venues | --pages] <output directory> <MusicBrainz ID>...");
  process.exit(1);
}

const now = venuesOnly ? setlistFmRecordedAt : new Date();
console.log(`Recorded at ${new Date().toISOString()}. The calculation time is ${now.toISOString()}.`);

async function record(url: string, file: string): Promise<{ status: number; body: string }> {
  const response = await fetch(url, { headers: { "x-api-key": apiKey!, accept: "application/json" } });
  const body = await response.text();
  writeFileSync(join(output!, file), `${JSON.stringify({ status: response.status, body: JSON.parse(body) }, null, 1)}\n`);
  console.log(`${file}: status ${response.status}`);
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  return { status: response.status, body };
}

// A recorded page from the output directory, for --venues. Status 404 when there is no file.
function recordedPage(file: string): { status: number; body: string } {
  if (!existsSync(join(output!, file))) return { status: 404, body: "{}" };
  const { status, body } = JSON.parse(readFileSync(join(output!, file), "utf8")) as { status: number; body: unknown };
  return { status, body: JSON.stringify(body) };
}

// The application reads the pages, so that the script gets and checks the same shows as a calculation.
const pages = new FakeHttpClient();
const setlistFm = createSetlistFm(pages);
const venueDates = new Map<string, { venueId: string; date: Date }>();

for (const id of musicbrainzIds) {
  const result = await lookBackShows(
    async (page) => {
      const file = setlistsFileName(id, page);
      const response = venuesOnly ? recordedPage(file) : await record(setlistFmSetlistsUrl(id, page), file);
      pages.respondTo("GET", setlistFmSetlistsUrl(id, page), response);
      return setlistFm.artistSetlists(id, page);
    },
    now,
    defaultPredictionSettings,
  );
  if ("cause" in result) {
    console.error(`${id}: ${result.cause}`);
    continue;
  }
  console.log(`${id}: ${result.shows.length} shows, look-back period ${result.lookBackMonths} months`);
  const period = { ...defaultPredictionSettings, lookBackMonths: result.lookBackMonths };
  for (const show of result.shows as Show[]) {
    if (show.venueId === undefined || !countsForScore(show, now, period)) continue;
    venueDates.set(venueSetlistsFileName(show.venueId, show.date), { venueId: show.venueId, date: show.date });
  }
}

for (const [file, { venueId, date }] of pagesOnly ? [] : venueDates) {
  if (venuesOnly && existsSync(join(output, file))) continue;
  await record(setlistFmVenueSetlistsUrl(venueId, date), file);
}
