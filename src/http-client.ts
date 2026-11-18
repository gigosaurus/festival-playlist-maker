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
// Later changes add the rules of setlist.fm and Spotify.
export function withServiceRules(transport: HttpClient, settings: Settings, clock: Clock): HttpClient {
  const clashfinderQueue = createPacedQueue(clock, clashfinderCrawlDelay, { service: "Clashfinder", ...clashfinderRequestLimit });
  const musicbrainzQueue = createPacedQueue(clock, musicbrainzRequestDelay);
  return {
    send(request) {
      const origin = new URL(request.url).origin;
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
  limit: { service: string; requests: number; period: number } = { service: "", requests: Infinity, period: 0 },
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
        const minutes = Math.ceil((retryAt.getTime() - now) / 60_000);
        throw new RequestLimitError(
          `The application sends a maximum of ${limit.requests} requests to ${limit.service} in ${limit.period / 60_000} minutes. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
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
