import { RequestLimitError, setlistFmOrigin, type HttpClient } from "./http-client.ts";

// The setlist.fm API requests (ADR-0002). The application uses the setlists only
// for a calculation and does not store them, because the setlist.fm terms do not
// permit storage beyond short-term caching.

export interface Show {
  // The date of the show, at 00:00 UTC.
  date: Date;
  // The songs in the order of the setlist, with the songs of all sets and encores.
  songs: { name: string; tape: boolean }[];
}

export type SetlistPageResult =
  | { outcome: "found"; shows: Show[]; lastPage: boolean }
  // setlist.fm has no setlists of the artist, or does not know the MusicBrainz ID.
  | { outcome: "no-setlists" }
  // `retryAt` is set when a rate limit stopped the request.
  | { outcome: "failed"; cause: string; retryAt?: Date };

export interface SetlistFm {
  // One page of the setlists of an artist. The first page has the most recent setlists.
  artistSetlists(musicbrainzId: string, page: number): Promise<SetlistPageResult>;
}

export function setlistFmSetlistsUrl(musicbrainzId: string, page: number): string {
  return `${setlistFmOrigin}/rest/1.0/artist/${encodeURIComponent(musicbrainzId)}/setlists?p=${page}`;
}

export function createSetlistFm(httpClient: HttpClient): SetlistFm {
  return {
    async artistSetlists(musicbrainzId, page) {
      let response: Response;
      try {
        response = await httpClient.send(new Request(setlistFmSetlistsUrl(musicbrainzId, page)));
      } catch (error) {
        if (error instanceof RequestLimitError) return { outcome: "failed", cause: error.message, retryAt: error.retryAt };
        return { outcome: "failed", cause: `The application could not connect to setlist.fm: ${error instanceof Error ? error.message : String(error)}` };
      }
      // setlist.fm gives status 404 for an artist with no setlists.
      if (response.status === 404) return { outcome: "no-setlists" };
      if (response.status === 403 || response.status === 401) {
        return { outcome: "failed", cause: `setlist.fm refused the API key (status ${response.status}). Make sure that SETLIST_FM_API_KEY is correct.` };
      }
      if (!response.ok) return { outcome: "failed", cause: `setlist.fm refused the request (status ${response.status}).` };
      const body = (await response.json().catch(() => undefined)) as
        | { setlist?: unknown; page?: unknown; itemsPerPage?: unknown; total?: unknown }
        | undefined;
      if (!Array.isArray(body?.setlist)) {
        return { outcome: "failed", cause: 'The setlist.fm response has no "setlist" list. The setlist.fm API possibly changed.' };
      }
      const shows = body.setlist.flatMap((each) => readShow(each) ?? []);
      const { itemsPerPage, total } = body;
      const lastPage =
        body.setlist.length === 0 || (typeof itemsPerPage === "number" && typeof total === "number" && page * itemsPerPage >= total);
      return { outcome: "found", shows, lastPage };
    },
  };
}

// A setlist: { "eventDate": "11-10-2026", "sets": { "set": [{ "song": [{ "name": "…", "tape": true }] }] } }.
function readShow(value: unknown): Show | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { eventDate, sets } = value as { eventDate?: unknown; sets?: { set?: unknown } };
  const date = typeof eventDate === "string" ? /^(\d{2})-(\d{2})-(\d{4})$/.exec(eventDate) : null;
  if (date === null) return undefined;
  const songs: Show["songs"] = [];
  for (const set of Array.isArray(sets?.set) ? sets.set : []) {
    const list = (set as { song?: unknown }).song;
    for (const song of Array.isArray(list) ? list : []) {
      const { name, tape } = song as { name?: unknown; tape?: unknown };
      if (typeof name === "string" && name.trim() !== "") songs.push({ name: name.trim(), tape: tape === true });
    }
  }
  return { date: new Date(Date.UTC(Number(date[3]), Number(date[2]) - 1, Number(date[1]))), songs };
}
