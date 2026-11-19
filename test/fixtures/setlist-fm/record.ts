// Records setlist.fm responses for the predicted song tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/setlist-fm/record.ts <output directory> <MusicBrainz ID>...
// For each artist, the script gets the setlist pages that a calculation at this
// time gets: it stops after the first page with a show before the look-back
// period, after the last page, or after status 404. It reads SETLIST_FM_API_KEY.
// It waits 2 seconds between requests.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { lookBackStart } from "../../../src/predicted-songs.ts";
import { setlistFmSetlistsUrl } from "../../../src/setlist-fm.ts";
import { defaultPredictionSettings } from "../../../src/settings.ts";
import { setlistsFileName } from "../../support/setlist-fm.ts";

const [output, ...musicbrainzIds] = process.argv.slice(2);
const apiKey = process.env.SETLIST_FM_API_KEY?.trim();
if (output === undefined || musicbrainzIds.length === 0 || !apiKey) {
  console.error("Usage: node --env-file=.env test/fixtures/setlist-fm/record.ts <output directory> <MusicBrainz ID>...");
  process.exit(1);
}

const now = new Date();
const start = lookBackStart(now, defaultPredictionSettings);
console.log(`Recorded at ${now.toISOString()}. The look-back period starts at ${start.toISOString()}.`);

for (const id of musicbrainzIds) {
  for (let page = 1; page <= defaultPredictionSettings.setlistPages; page++) {
    const response = await fetch(setlistFmSetlistsUrl(id, page), { headers: { "x-api-key": apiKey, accept: "application/json" } });
    const body = await response.text();
    const file = setlistsFileName(id, page);
    writeFileSync(join(output, file), `${JSON.stringify({ status: response.status, body: JSON.parse(body) }, null, 1)}\n`);
    console.log(`${file}: status ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (!response.ok) break;
    const { setlist, itemsPerPage, total } = JSON.parse(body) as { setlist: { eventDate: string }[]; itemsPerPage: number; total: number };
    const dates = setlist.map(({ eventDate }) => {
      const [day, month, year] = eventDate.split("-").map(Number);
      return new Date(Date.UTC(year!, month! - 1, day));
    });
    if (page * itemsPerPage >= total || dates.some((date) => date < start)) break;
  }
}
