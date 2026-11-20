// Records MusicBrainz responses for the artist match tests.
// Usage, from the repository root:
//   node --env-file-if-exists=.env test/fixtures/musicbrainz/record.ts <output directory> <search text>...
// An argument "links:<MusicBrainz ID>" records the lookup of that artist with its links.
// An argument "events:<MusicBrainz ID>" records the pages of the events of that artist (#13).
// An argument "albums:<MusicBrainz ID>" records the requests of `albums` (#14): the
// pages of the albums of that artist, and the releases of each album that a calculation
// at setlistFmRecordedAt can use. The longest look-back period gives the earliest date.
// The script reads MUSICBRAINZ_CONTACT for the User-Agent. It waits 2 seconds
// between requests, and sends a request again after status 503.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  createMusicBrainz,
  eventsPerPage,
  genreListUrl,
  maximumEventPages,
  musicbrainzEventsUrl,
  musicbrainzLinksUrl,
  musicbrainzSearchUrl,
} from "../../../src/musicbrainz.ts";
import { longestLookBack } from "../../../src/predicted-songs.ts";
import { defaultPredictionSettings } from "../../../src/settings.ts";
import { albumsFileName, eventsFileName, fixtureFileName, linksFileName } from "../../support/musicbrainz.ts";
import { setlistFmRecordedAt } from "../../support/setlist-fm.ts";

const [output, ...texts] = process.argv.slice(2);
const contact = process.env.MUSICBRAINZ_CONTACT?.trim();
if (output === undefined || !contact) {
  console.error("Usage: MUSICBRAINZ_CONTACT=<contact> node test/fixtures/musicbrainz/record.ts <output directory> <search text>...");
  process.exit(1);
}
const userAgent = `FestivalPlaylistMaker-fixtures/1 ( ${contact} )`;

async function record(url: string, file: string): Promise<string | undefined> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    const response = await fetch(url, { headers: { "user-agent": userAgent, accept: file.endsWith(".txt") ? "text/plain" : "application/json" } });
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    if (response.status === 503) continue;
    const body = await response.text();
    writeFileSync(join(output!, file), file.endsWith(".json") ? `${JSON.stringify(JSON.parse(body), null, 1)}\n` : body);
    console.log(`${file}: status ${response.status}`);
    return body;
  }
  console.error(`${file}: status 503 eight times`);
  return undefined;
}

const lookups = texts.filter((text) => text.startsWith("links:")).map((text) => text.slice("links:".length));
const eventArtists = texts.filter((text) => text.startsWith("events:")).map((text) => text.slice("events:".length));
const albumArtists = texts.filter((text) => text.startsWith("albums:")).map((text) => text.slice("albums:".length));
const searches = texts.filter((text) => !/^(links|events|albums):/.test(text));
if (searches.length > 0) await record(genreListUrl, "genres.txt");
for (const text of searches) await record(musicbrainzSearchUrl(text), fixtureFileName(text));
for (const id of lookups) await record(musicbrainzLinksUrl(id), linksFileName(id));
for (const id of eventArtists) {
  for (let page = 1; page <= maximumEventPages; page++) {
    const body = await record(musicbrainzEventsUrl(id, (page - 1) * eventsPerPage), eventsFileName(id, page));
    const total = body === undefined ? 0 : ((JSON.parse(body) as { "event-count"?: number })["event-count"] ?? 0);
    if (page * eventsPerPage >= total) break;
  }
}

// The application sends the album requests, so that the files are the responses of a calculation.
const since = new Date(setlistFmRecordedAt);
since.setUTCMonth(since.getUTCMonth() - longestLookBack(defaultPredictionSettings) - defaultPredictionSettings.albumFocusedMonths);
const recording = {
  async send(request: Request): Promise<Response> {
    const body = await record(request.url, albumsFileName(request.url));
    return new Response(body ?? "", { status: body === undefined ? 503 : 200, headers: { "content-type": "application/json" } });
  },
};
for (const id of albumArtists) {
  const result = await createMusicBrainz(recording).albums(id, since.toISOString().slice(0, 10));
  console.log(`${id}: ${JSON.stringify(result.outcome === "found" ? result.albums.map(({ title, released }) => `${title} (${released})`) : result)}`);
}
