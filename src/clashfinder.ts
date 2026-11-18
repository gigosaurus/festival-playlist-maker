import type { Clock } from "./clock.ts";
import { clashfinderOrigin, RequestLimitError, type HttpClient } from "./http-client.ts";
import type { ClashfinderSettings, LineupEntry, LineupResult, LineupSource } from "./lineup-source.ts";

// The Clashfinder API: clashfinder.com/pages/api. The HTTP client adds the
// signed keys and keeps the crawl delay. ADR-0006 gives the rules.

// The list of all Clashfinder pages. The list of "core" pages is smaller, but
// it does not contain most of the pages that users make.
export const clashfinderListUrl = `${clashfinderOrigin}/data/events/all.json`;

export function clashfinderExportUrl(page: string): string {
  return `${clashfinderOrigin}/data/event/${encodeURIComponent(page)}.json`;
}

// The address of the page for people.
export function clashfinderPageAddress(page: string): string {
  return `${clashfinderOrigin}/s/${encodeURIComponent(page)}/`;
}

// The list is approximately 4 MB. The application keeps it for one hour, so that
// a second search does not send a request.
export const clashfinderListLifetime = 60 * 60_000;

// The maximum number of pages in each group of search results.
export const maximumResults = 20;

const pageIdPattern = /^[A-Za-z0-9_-]{1,100}$/;

export function isClashfinderPageId(value: string): boolean {
  return pageIdPattern.test(value);
}

export interface ClashfinderPage {
  id: string;
  name: string;
  // The ISO date of the first day.
  startDate?: string;
  days?: number;
  stages?: number;
  acts?: number;
  // The ISO date of the last change.
  lastEdit?: string;
  // Clashfinder marks the pages that it recommends as "core".
  core: boolean;
  // Clashfinder marks a page that the festival made as "official".
  official: boolean;
}

export interface FestivalDates {
  start: string;
  end: string;
}

export interface SearchResults {
  // The pages with all of the words of the search text in their name or ID.
  // The page that the search text gives as an ID or an address is first.
  nameMatches: ClashfinderPage[];
  // Pages that start in the festival dates and do not match the name, for
  // example "DLXXIV" for Download. Empty when the search has no festival dates.
  dateMatches: ClashfinderPage[];
  // The number of date matches before the limit of `maximumResults`.
  dateMatchCount: number;
}

export type SearchResult = ({ outcome: "found" } & SearchResults) | { outcome: "failed"; cause: string };

export interface Clashfinder extends LineupSource {
  search(text: string, dates: FestivalDates | undefined): Promise<SearchResult>;
  // A page from the list of the last search. It sends no request.
  cachedPage(id: string): ClashfinderPage | undefined;
  getLineup(settings: ClashfinderSettings): Promise<LineupResult>;
}

export function createClashfinder(httpClient: HttpClient, clock: Clock): Clashfinder {
  let list: { pages: ClashfinderPage[]; gotAt: number } | undefined;

  return {
    async search(text, dates) {
      const now = clock.now().getTime();
      if (list === undefined || now - list.gotAt >= clashfinderListLifetime || now < list.gotAt) {
        const result = await getList(httpClient);
        if (result.outcome === "failed") return result;
        list = { pages: result.pages, gotAt: now };
      }
      return { outcome: "found", ...searchPages(list.pages, text, dates) };
    },

    cachedPage(id) {
      return list?.pages.find((page) => page.id === id);
    },

    async getLineup(settings) {
      const response = await send(httpClient, clashfinderExportUrl(settings.page));
      if (response instanceof Failure) return { outcome: "failed", cause: response.cause };
      if (!response.ok) {
        return { outcome: "failed", cause: await describeRefusal(response, `the page "${settings.page}"`) };
      }
      const body = await readJson(response);
      if (body instanceof Failure) return { outcome: "failed", cause: body.cause };
      return readLineup(body);
    },
  };
}

// Gives the pages that agree with the search text and the festival dates, in order.
export function searchPages(pages: ClashfinderPage[], text: string, dates: FestivalDates | undefined): SearchResults {
  const exactId = pageIdFromText(text);
  const words = normalise(text).split(" ").filter(Boolean);
  const inDates = (page: ClashfinderPage) =>
    dates !== undefined && page.startDate !== undefined && page.startDate >= dates.start && page.startDate <= dates.end;
  const matchesName = (page: ClashfinderPage) => {
    if (page.id.toLowerCase() === exactId) return true;
    if (words.length === 0) return false;
    const searchable = normalise(`${page.name} ${page.id}`);
    return words.every((word) => searchable.includes(word));
  };
  const distance = (page: ClashfinderPage) =>
    dates === undefined || page.startDate === undefined
      ? Number.MAX_SAFE_INTEGER
      : Math.abs(Date.parse(page.startDate) - Date.parse(dates.start));

  const nameMatches = pages
    .filter(matchesName)
    .sort(
      (a, b) =>
        Number(b.id.toLowerCase() === exactId) - Number(a.id.toLowerCase() === exactId) ||
        Number(inDates(b)) - Number(inDates(a)) ||
        distance(a) - distance(b) ||
        (b.startDate ?? "").localeCompare(a.startDate ?? "") ||
        (b.acts ?? 0) - (a.acts ?? 0),
    );
  // A page with more acts is more probably the complete lineup.
  const dateMatches = pages
    .filter((page) => inDates(page) && !matchesName(page))
    .sort((a, b) => (b.acts ?? 0) - (a.acts ?? 0) || a.name.localeCompare(b.name));
  return {
    nameMatches: nameMatches.slice(0, maximumResults),
    dateMatches: dateMatches.slice(0, maximumResults),
    dateMatchCount: dateMatches.length,
  };
}

// The admin can paste the address of a Clashfinder page, or type its ID.
function pageIdFromText(text: string): string | undefined {
  const trimmed = text.trim();
  const address = /clashfinder\.com\/(?:s|m|data\/event)\/([A-Za-z0-9_-]+)/i.exec(trimmed);
  if (address) return address[1]!.toLowerCase();
  return isClashfinderPageId(trimmed) ? trimmed.toLowerCase() : undefined;
}

// Lowercase, without accents, with each run of other characters as one space.
function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function getList(httpClient: HttpClient): Promise<{ outcome: "got"; pages: ClashfinderPage[] } | { outcome: "failed"; cause: string }> {
  const response = await send(httpClient, clashfinderListUrl);
  if (response instanceof Failure) return { outcome: "failed", cause: response.cause };
  if (!response.ok) return { outcome: "failed", cause: await describeRefusal(response, "the list of pages") };
  const body = await readJson(response);
  if (body instanceof Failure) return { outcome: "failed", cause: body.cause };
  if (!isRecord(body)) {
    return { outcome: "failed", cause: "The Clashfinder list of pages is not a JSON object. The Clashfinder API possibly changed." };
  }
  const pages: ClashfinderPage[] = [];
  for (const [key, value] of Object.entries(body)) {
    if (!isRecord(value)) continue;
    const id = typeof value.name === "string" ? value.name : key;
    if (!isClashfinderPageId(id)) continue;
    pages.push({
      id,
      name: typeof value.desc === "string" && value.desc.trim() ? value.desc.trim() : id,
      startDate: typeof value.startDate === "number" ? new Date(value.startDate * 1000).toISOString().slice(0, 10) : undefined,
      days: positiveNumber(value.numDays),
      stages: positiveNumber(value.numStages),
      acts: positiveNumber(value.numActs),
      lastEdit: typeof value.lastEdit === "string" && /^\d{4}-\d{2}-\d{2}/.test(value.lastEdit) ? value.lastEdit.slice(0, 10) : undefined,
      core: value.coreClashfinder === true,
      official: value.officialClashfinder === true,
    });
  }
  if (pages.length === 0) {
    return { outcome: "failed", cause: "The Clashfinder list of pages has no pages. The Clashfinder API possibly changed." };
  }
  return { outcome: "got", pages };
}

// The export of one page. Recorded examples are in test/fixtures/clashfinder/.
function readLineup(body: unknown): LineupResult {
  if (!isRecord(body) || !Array.isArray(body.locations)) {
    return { outcome: "failed", cause: 'The Clashfinder response has no "locations" list. The Clashfinder API possibly changed.' };
  }
  if (isRecord(body.auth) && body.auth.result !== undefined && body.auth.result !== "pass") {
    return { outcome: "failed", cause: `Clashfinder refused the API key: ${String(body.auth.result)}. ${checkSettings}` };
  }
  const entries: LineupEntry[] = [];
  for (const location of body.locations) {
    if (!isRecord(location) || !Array.isArray(location.events)) continue;
    const stage = text(location.name);
    for (const event of location.events) {
      if (!isRecord(event)) continue;
      const name = text(event.name);
      if (name === undefined) continue;
      const entry: LineupEntry = { name };
      if (stage !== undefined) entry.stage = stage;
      const start = localTime(event.start);
      const end = localTime(event.end);
      if (start !== undefined) entry.start = start;
      if (end !== undefined) entry.end = end;
      entries.push(entry);
    }
  }
  // An empty page does not replace a lineup. This keeps the lineup when a person empties the page.
  if (entries.length === 0) return { outcome: "failed", cause: "The Clashfinder page has no lineup names." };
  const timezone = text(body.timezone);
  return { outcome: "got", lineup: timezone === undefined ? { entries } : { entries, timezone } };
}

const checkSettings = "Check CLASHFINDER_USERNAME and CLASHFINDER_PRIVATE_KEY in the .env file.";

// A failure before Clashfinder gave a usable response.
class Failure {
  readonly cause: string;

  constructor(cause: string) {
    this.cause = cause;
  }
}

async function send(httpClient: HttpClient, url: string): Promise<Response | Failure> {
  try {
    return await httpClient.send(new Request(url, { headers: { accept: "application/json" } }));
  } catch (error) {
    if (error instanceof RequestLimitError) return new Failure(error.message);
    return new Failure(`The application could not connect to Clashfinder: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return new Failure("The Clashfinder response is not valid JSON. The Clashfinder API possibly changed.");
  }
}

// Clashfinder gives status 401 with {"error": "..."} for a key problem, and
// status 404 with a text message for an unknown page. The text message
// contains a server path, so the application does not show it.
async function describeRefusal(response: Response, subject: string): Promise<string> {
  if (response.status === 404) return `Clashfinder does not have ${subject} (status 404).`;
  let message: string | undefined;
  try {
    const body: unknown = JSON.parse(await response.text());
    if (isRecord(body)) message = text(body.error);
  } catch {
    message = undefined;
  }
  const detail = message === undefined ? "" : `: ${message.slice(0, 200)}`;
  if (response.status === 401 || response.status === 403) {
    return `Clashfinder refused the API key (status ${response.status})${detail}. ${checkSettings}`;
  }
  return `Clashfinder did not give ${subject} (status ${response.status})${detail}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Trimmed text with each run of white space as one space, or undefined when it is empty.
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const result = value.replace(/\s+/g, " ").trim();
  return result === "" ? undefined : result;
}

// Clashfinder gives local times as "YYYY-MM-DD HH:MM".
function localTime(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(value.trim());
  return match ? `${match[1]}T${match[2]}` : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
