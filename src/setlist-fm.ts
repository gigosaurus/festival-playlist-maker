import { RequestLimitError, setlistFmOrigin, type HttpClient } from "./http-client.ts";

// The setlist.fm API requests (ADR-0002). The application uses the setlists only
// for a calculation and does not store them, because the setlist.fm terms do not
// permit storage beyond short-term caching.

export interface Show {
  // The date of the show, at 00:00 UTC.
  date: Date;
  // The songs in the order of the setlist, with the songs of all sets and encores.
  songs: { name: string; tape: boolean }[];
  // The setlist.fm venue ID. A setlist without a venue ID has none.
  venueId?: string;
  // The name of the tour on setlist.fm. A show that is not in a tour has none.
  tour?: string;
}

export type SetlistPageResult =
  | { outcome: "found"; shows: Show[]; lastPage: boolean }
  // setlist.fm has no setlists of the artist, or does not know the MusicBrainz ID.
  | { outcome: "no-setlists" }
  // `retryAt` is set when a rate limit stopped the request.
  | { outcome: "failed"; cause: string; retryAt?: Date };

export type VenueArtistsResult =
  | { outcome: "found"; artists: number }
  // `retryAt` is set when a rate limit stopped the request.
  | { outcome: "failed"; cause: string; retryAt?: Date };

export interface SetlistFm {
  // One page of the setlists of an artist. The first page has the most recent setlists.
  artistSetlists(musicbrainzId: string, page: number): Promise<SetlistPageResult>;
  // The number of artists with a setlist at a venue on a date (issue #13).
  venueArtists(venueId: string, date: Date): Promise<VenueArtistsResult>;
}

export function setlistFmSetlistsUrl(musicbrainzId: string, page: number): string {
  return `${setlistFmOrigin}/rest/1.0/artist/${encodeURIComponent(musicbrainzId)}/setlists?p=${page}`;
}

// The setlist search for one venue and one date. setlist.fm gives the date as dd-MM-yyyy.
export function setlistFmVenueSetlistsUrl(venueId: string, date: Date): string {
  return `${setlistFmOrigin}/rest/1.0/search/setlists?venueId=${encodeURIComponent(venueId)}&date=${setlistFmDate(date)}`;
}

export function setlistFmDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${date.getUTCFullYear()}`;
}

type Failure = { outcome: "failed"; cause: string; retryAt?: Date };

export function createSetlistFm(httpClient: HttpClient): SetlistFm {
  // Sends a request. Gives the response, or the failure when the request failed
  // or setlist.fm refused it. Status 404 is a response, because setlist.fm gives
  // it for a search with no setlists.
  async function send(url: string): Promise<Response | Failure> {
    let response: Response;
    try {
      response = await httpClient.send(new Request(url));
    } catch (error) {
      if (error instanceof RequestLimitError) return { outcome: "failed", cause: error.message, retryAt: error.retryAt };
      return { outcome: "failed", cause: `The application could not connect to setlist.fm: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (response.status === 404) return response;
    if (response.status === 403 || response.status === 401) {
      return { outcome: "failed", cause: `setlist.fm refused the API key (status ${response.status}). Make sure that SETLIST_FM_API_KEY is correct.` };
    }
    if (!response.ok) return { outcome: "failed", cause: `setlist.fm refused the request (status ${response.status}).` };
    return response;
  }

  return {
    async artistSetlists(musicbrainzId, page) {
      const response = await send(setlistFmSetlistsUrl(musicbrainzId, page));
      if (!(response instanceof Response)) return response;
      // setlist.fm gives status 404 for an artist with no setlists.
      if (response.status === 404) return { outcome: "no-setlists" };
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

    async venueArtists(venueId, date) {
      const response = await send(setlistFmVenueSetlistsUrl(venueId, date));
      if (!(response instanceof Response)) return response;
      // setlist.fm gives status 404 for a search with no setlists.
      if (response.status === 404) return { outcome: "found", artists: 0 };
      const body = (await response.json().catch(() => undefined)) as
        | { setlist?: unknown; itemsPerPage?: unknown; total?: unknown }
        | undefined;
      if (!Array.isArray(body?.setlist)) {
        return { outcome: "failed", cause: 'The setlist.fm response has no "setlist" list. The setlist.fm API possibly changed.' };
      }
      // An artist can have two setlists on one date, so the application counts
      // the different artists on the first page. A page has a maximum of 20 setlists.
      // When there are more pages, the total number of setlists is the count.
      const artists = new Set<string>();
      for (const setlist of body.setlist) {
        const artist = (setlist as { artist?: { mbid?: unknown; name?: unknown } }).artist;
        const key = typeof artist?.mbid === "string" ? artist.mbid : typeof artist?.name === "string" ? artist.name : undefined;
        if (key !== undefined) artists.add(key);
      }
      const { itemsPerPage, total } = body;
      const morePages = typeof itemsPerPage === "number" && typeof total === "number" && total > itemsPerPage;
      return { outcome: "found", artists: morePages ? (total as number) : artists.size };
    },
  };
}

// A setlist: { "eventDate": "11-10-2026", "venue": { "id": "3bd634d0" }, "tour": { "name": "…" },
// "sets": { "set": [{ "song": [{ "name": "…", "tape": true }] }] } }.
function readShow(value: unknown): Show | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { eventDate, sets, venue, tour } = value as { eventDate?: unknown; sets?: { set?: unknown }; venue?: { id?: unknown }; tour?: { name?: unknown } };
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
  const show: Show = { date: new Date(Date.UTC(Number(date[3]), Number(date[2]) - 1, Number(date[1]))), songs };
  if (typeof venue?.id === "string" && venue.id !== "") show.venueId = venue.id;
  if (typeof tour?.name === "string" && tour.name.trim() !== "") show.tour = tour.name.trim();
  return show;
}
