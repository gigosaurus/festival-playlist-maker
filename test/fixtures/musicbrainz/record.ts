// Records MusicBrainz responses for the artist match tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/musicbrainz/record.ts <output directory> <search text>...
// The script reads MUSICBRAINZ_CONTACT for the User-Agent. It waits 2 seconds
// between requests, and sends a request again after status 503.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { genreListUrl, musicbrainzSearchUrl } from "../../../src/musicbrainz.ts";
import { fixtureFileName } from "../../support/musicbrainz.ts";

const [output, ...texts] = process.argv.slice(2);
const contact = process.env.MUSICBRAINZ_CONTACT?.trim();
if (output === undefined || !contact) {
  console.error("Usage: MUSICBRAINZ_CONTACT=<contact> node test/fixtures/musicbrainz/record.ts <output directory> <search text>...");
  process.exit(1);
}
const userAgent = `FestivalPlaylistMaker-fixtures/1 ( ${contact} )`;

async function record(url: string, file: string): Promise<void> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const response = await fetch(url, { headers: { "user-agent": userAgent, accept: file.endsWith(".txt") ? "text/plain" : "application/json" } });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (response.status === 503) continue;
    const body = await response.text();
    writeFileSync(join(output!, file), file.endsWith(".json") ? `${JSON.stringify(JSON.parse(body), null, 1)}\n` : body);
    console.log(`${file}: status ${response.status}`);
    return;
  }
  console.error(`${file}: status 503 eight times`);
}

await record(genreListUrl, "genres.txt");
for (const text of texts) await record(musicbrainzSearchUrl(text), fixtureFileName(text));
