import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Clock } from "./clock.ts";
import type { Settings } from "./settings.ts";

// All outbound requests go through one HttpClient. The application gets the
// client by injection, so tests can replace it with a fake.
export interface HttpClient {
  send(request: Request): Promise<Response>;
}

export function createFetchHttpClient(): HttpClient {
  return {
    send: (request) => fetch(request),
  };
}

export const clashfinderOrigin = "https://clashfinder.com";

// clashfinder.com/robots.txt has "Crawl-delay: 10".
export const clashfinderCrawlDelay = 10_000;

// Each Clashfinder export response since November 2026 says: "Starting 31st March
// 2027, API requests will be limited to 10 per user or IP address in 5 minutes."
export const clashfinderRequestLimit = { requests: 10, period: 5 * 60_000 };

export const musicbrainzOrigin = "https://musicbrainz.org";

// musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting: "an average of one request
// per second". The pause starts at the end of each response, so the average is lower.
export const musicbrainzRequestDelay = 1_000;

export const spotifyApiOrigin = "https://api.spotify.com";

// Spotify does not publish the rate limit. It counts the requests in a rolling
// 30-second window, and Development Mode has a lower limit (ADR-0001). The
// application needs few Spotify requests, so it uses a long pause.
export const spotifyRequestDelay = 1_000;

// After status 429, Spotify gives the wait in seconds in Retry-After. The HTTP
// client waits and sends the request again when the wait is this long or shorter.
// After a longer wait, it refuses the Spotify requests until the wait is complete,
// because a page cannot wait for minutes.
export const spotifyLongestWait = 60_000;

// The HTTP client sends a request again a maximum of this number of times after status 429.
const spotifyRetries = 3;

export const setlistFmOrigin = "https://api.setlist.fm";

// The setlist.fm API settings of the account give the rate limit of the API key:
// a maximum of 2 requests each second and 1,440 requests each day. The public
// documentation does not publish it. The pause starts at the end of each
// response, so the rate is lower than 2 each second.
export const setlistFmRequestDelay = 500;

// The application counts the requests in the last 24 hours. Then it cannot send
// more than 1,440 requests in one calendar day. The count starts again when the
// application starts.
export const setlistFmRequestLimit = { requests: 1_440, period: 24 * 60 * 60_000, periodText: "24 hours" };

// The setlist.fm documentation does not tell what a refused request gets. When
// setlist.fm gives status 429 without a Retry-After value, the application waits for this time.
export const setlistFmLimitWait = 60_000;

const applicationVersion = (
  JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }
).version;

// MusicBrainz blocks a client that has no meaningful User-Agent. The format is
// "Application name/version ( contact )".
export function musicbrainzUserAgent(settings: Settings): string {
  return `FestivalPlaylistMaker/${applicationVersion} ( ${settings.musicbrainzContact} )`;
}

// The request limit of a service stopped a request before the application sent it.
export class RequestLimitError extends Error {
  readonly retryAt: Date;

  constructor(message: string, retryAt: Date) {
    super(message);
    this.name = "RequestLimitError";
    this.retryAt = retryAt;
  }
}

// Applies the rules of each service to the requests that go through `transport`.
export function withServiceRules(transport: HttpClient, settings: Settings, clock: Clock): HttpClient {
  const clashfinderQueue = createPacedQueue(clock, clashfinderCrawlDelay, { service: "Clashfinder", ...clashfinderRequestLimit });
  const musicbrainzQueue = createPacedQueue(clock, musicbrainzRequestDelay);
  const setlistFmQueue = createPacedQueue(clock, setlistFmRequestDelay, { service: "setlist.fm", ...setlistFmRequestLimit });
  const spotify = createSpotifyRules(transport, clock);
  return {
    send(request) {
      const origin = new URL(request.url).origin;
      if (origin === spotifyApiOrigin) return spotify(request);
      if (origin === setlistFmOrigin) {
        return setlistFmQueue(async () => {
          const response = await transport.send(signSetlistFmRequest(request, settings));
          if (response.status !== 429) return response;
          const retryAt = new Date(clock.now().getTime() + (retryAfter(response.headers.get("retry-after")) ?? setlistFmLimitWait));
          throw new RequestLimitError(`setlist.fm limited the requests of the application (status 429).`, retryAt);
        });
      }
      if (origin === clashfinderOrigin) return clashfinderQueue(() => transport.send(signClashfinderRequest(request, settings)));
      if (origin === musicbrainzOrigin) {
        return musicbrainzQueue(() => {
          const identified = new Request(request);
          identified.headers.set("user-agent", musicbrainzUserAgent(settings));
          return transport.send(identified);
        });
      }
      return transport.send(request);
    },
  };
}

// The setlist.fm API needs the API key in the x-api-key header. Without
// "Accept: application/json", it gives XML (api.setlist.fm/docs/1.0/index.html).
export function signSetlistFmRequest(request: Request, settings: Settings): Request {
  const signed = new Request(request);
  signed.headers.set("x-api-key", settings.setlistFmApiKey);
  signed.headers.set("accept", "application/json");
  return signed;
}

// The Clashfinder API needs authUsername and authPublicKey on each request
// (clashfinder.com/pages/api, ADR-0006). The application uses no optional
// parameters, so the public key is the SHA-256 hash of the username and the private key.
export function clashfinderPublicKey(username: string, privateKey: string): string {
  return createHash("sha256").update(username + privateKey).digest("hex");
}

export function signClashfinderRequest(request: Request, settings: Settings): Request {
  const url = new URL(request.url);
  url.searchParams.set("authUsername", settings.clashfinderUsername);
  url.searchParams.set("authPublicKey", clashfinderPublicKey(settings.clashfinderUsername, settings.clashfinderPrivateKey));
  return new Request(url, request);
}

// Sends one request at a time. Between the end of a response and the next
// request, it waits for `delay`. When `limit.requests` requests started in the
// last `limit.period`, it refuses the request with a RequestLimitError. It does
// not wait for the limit, because the wait can be a number of minutes.
function createPacedQueue(
  clock: Clock,
  delay: number,
  limit: { service: string; requests: number; period: number; periodText?: string } = { service: "", requests: Infinity, period: 0 },
): (send: () => Promise<Response>) => Promise<Response> {
  let queue: Promise<unknown> = Promise.resolve();
  let lastEnd: number | undefined;
  const starts: number[] = [];

  return (send) => {
    const result = queue.then(async () => {
      const now = clock.now().getTime();
      while (starts.length > 0 && starts[0]! <= now - limit.period) starts.shift();
      if (starts.length >= limit.requests) {
        const retryAt = new Date(starts[0]! + limit.period);
        throw new RequestLimitError(
          `The application sends a maximum of ${limit.requests.toLocaleString("en-GB")} requests to ${limit.service} in ${limit.periodText ?? `${limit.period / 60_000} minutes`}. Try again in ${waitText(retryAt.getTime() - now)}.`,
          retryAt,
        );
      }
      if (lastEnd !== undefined && now - lastEnd < delay) await clock.sleep(delay - (now - lastEnd));
      starts.push(clock.now().getTime());
      try {
        return await send();
      } finally {
        lastEnd = clock.now().getTime();
      }
    });
    queue = result.catch(() => undefined);
    return result;
  };
}

// A wait in minutes, or in hours when it is 2 hours or longer: "4 minutes", "23 hours".
function waitText(milliseconds: number): string {
  const minutes = Math.ceil(milliseconds / 60_000);
  if (minutes < 120) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  return `${Math.ceil(minutes / 60)} hours`;
}

// Spotify gives status 429 with "reason": "QUOTA_EXCEEDED" in the error when the
// application used all of its quota. The quota is not published, and a new
// request does not help, so the HTTP client does not send the request again.
// developer.spotify.com/documentation/web-api/concepts/api-calls
export class SpotifyQuotaError extends RequestLimitError {
  constructor(retryAt: Date) {
    super(
      "Spotify refused the request because the application used all of its Spotify quota (status 429, QUOTA_EXCEEDED). Spotify does not publish the quota. Try again later.",
      retryAt,
    );
    this.name = "SpotifyQuotaError";
  }
}

// Paces the Spotify Web API requests and obeys Retry-After after status 429.
function createSpotifyRules(transport: HttpClient, clock: Clock): (request: Request) => Promise<Response> {
  const queue = createPacedQueue(clock, spotifyRequestDelay);
  // The time until which Spotify refuses requests, after a long Retry-After or a quota error.
  let blockedUntil: { at: Date; quota: boolean } | undefined;

  return (request) =>
    queue(async () => {
      for (let retry = 0; ; retry++) {
        if (blockedUntil !== undefined && clock.now() < blockedUntil.at) {
          if (blockedUntil.quota) throw new SpotifyQuotaError(blockedUntil.at);
          throw spotifyLimitError(clock, blockedUntil.at);
        }
        const response = await transport.send(request.clone());
        if (response.status !== 429) return response;
        const wait = retryAfter(response.headers.get("retry-after"));
        if (await isQuotaError(response)) {
          // Without Retry-After, the next request goes to Spotify, which gives the error again.
          const at = new Date(clock.now().getTime() + (wait ?? 0));
          blockedUntil = { at, quota: true };
          throw new SpotifyQuotaError(at);
        }
        const delay = wait ?? spotifyRequestDelay;
        if (delay > spotifyLongestWait || retry >= spotifyRetries) {
          blockedUntil = { at: new Date(clock.now().getTime() + delay), quota: false };
          throw spotifyLimitError(clock, blockedUntil.at);
        }
        await clock.sleep(delay);
      }
    });
}

function spotifyLimitError(clock: Clock, retryAt: Date): RequestLimitError {
  const minutes = Math.max(1, Math.ceil((retryAt.getTime() - clock.now().getTime()) / 60_000));
  return new RequestLimitError(
    `Spotify limited the requests of the application (status 429). Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    retryAt,
  );
}

// Retry-After in seconds, as milliseconds. Undefined when the header is missing or not a number.
function retryAfter(value: string | null): number | undefined {
  if (value === null || !/^\s*\d+\s*$/.test(value)) return undefined;
  return Number(value) * 1000;
}

async function isQuotaError(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.clone().json();
    const error = typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;
    return typeof error === "object" && error !== null && (error as { reason?: unknown }).reason === "QUOTA_EXCEEDED";
  } catch {
    return false;
  }
}
