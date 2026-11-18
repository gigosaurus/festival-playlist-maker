import { test as base, expect } from "@playwright/test";
import { spotifyAuthoriseUrl, spotifyProfileUrl, spotifyTokenUrl } from "../../src/spotify-log-in.ts";
import type { RecordedResponse } from "../support/fake-http-client.ts";
import {
  adminSpotifyUserId,
  spotifyNotOnAllowlistResponse,
  spotifyProfileResponse,
  spotifyTokenResponse,
} from "../support/test-settings.ts";

export interface TestServer {
  setTime(now: Date): Promise<void>;
  time(): Promise<Date>;
  respondTo(method: string, url: string, response: RecordedResponse): Promise<void>;
  sentHttpRequests(): Promise<{ method: string; url: string; body?: string }[]>;
}

export interface SpotifyAccount {
  id: string;
  displayName: string;
}

export const testUser: SpotifyAccount = { id: "alex-on-allowlist", displayName: "Alex Example" };
export const testAdmin: SpotifyAccount = { id: adminSpotifyUserId, displayName: "Kit Admin" };

// What the person does on the Spotify authorisation page.
export type SpotifyAnswer = "agree" | "cancel";

export interface Spotify {
  // Prepares the fake Spotify for the next log in.
  willLogIn(account: SpotifyAccount): Promise<void>;
  willRefuseNotOnAllowlist(): Promise<void>;
  // The browser cannot open Spotify in the tests. The fake authorisation page
  // sends the browser back to the application immediately, as Spotify does.
  answerAuthorisation(answer: SpotifyAnswer): Promise<void>;
}

// A fake for an external page that sends the browser back to the application.
// It gives the address that the external page sends the browser to, or undefined
// when it does not apply to the address.
type ExternalRedirect = (url: URL) => string | undefined;

interface ExternalRedirects {
  add(fake: ExternalRedirect): void;
  answer(url: URL): string | undefined;
}

// Each test starts with reset fakes. The browser can load only pages and files
// from the test server. A request to a different host fails the test.
export const test = base.extend<{
  testServer: TestServer;
  spotify: Spotify;
  logIn: (account?: SpotifyAccount) => Promise<void>;
  externalRedirects: ExternalRedirects;
  externalRequestGuard: void;
}>({
  testServer: async ({ request }, use) => {
    await expectOk(request.post("/__test/reset"));
    await use({
      setTime: (now) => expectOk(request.post("/__test/clock", { data: { now: now.toISOString() } })),
      time: async () => new Date((await (await request.get("/__test/clock")).json()).now),
      respondTo: (method, url, response) =>
        expectOk(request.post("/__test/http-responses", { data: { method, url, response } })),
      sentHttpRequests: async () => (await request.get("/__test/http-requests")).json(),
    });
  },
  spotify: async ({ testServer, externalRedirects }, use) => {
    await use({
      willLogIn: async (account) => {
        await testServer.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
        await testServer.respondTo("GET", spotifyProfileUrl, spotifyProfileResponse(account.id, account.displayName));
      },
      willRefuseNotOnAllowlist: async () => {
        await testServer.respondTo("POST", spotifyTokenUrl, spotifyTokenResponse());
        await testServer.respondTo("GET", spotifyProfileUrl, spotifyNotOnAllowlistResponse);
      },
      answerAuthorisation: async (answer) => {
        externalRedirects.add((url) => (url.href.startsWith(`${spotifyAuthoriseUrl}?`) ? callback(url, answer) : undefined));
      },
    });
  },
  logIn: async ({ page, spotify }, use) => {
    await use(async (account = testUser) => {
      await spotify.willLogIn(account);
      await spotify.answerAuthorisation("agree");
      await page.goto("/log-in");
      await page.getByRole("button", { name: "Log in with Spotify" }).click();
      await expect(page.getByRole("button", { name: "Log out" })).toBeVisible();
    });
  },
  externalRedirects: async ({}, use) => {
    const fakes: ExternalRedirect[] = [];
    await use({ add: (fake) => fakes.push(fake), answer: (url) => fakes.map((fake) => fake(url)).find(Boolean) });
  },
  externalRequestGuard: [
    async ({ page, baseURL, externalRedirects }, use) => {
      const allowedOrigin = new URL(baseURL!).origin;
      const blocked: string[] = [];
      await page.route(
        () => true,
        async (route) => {
          const url = new URL(route.request().url());
          if (url.protocol === "data:") return route.fallback();
          if (url.origin !== allowedOrigin) {
            blocked.push(url.href);
            return route.abort("blockedbyclient");
          }
          // Playwright does not route the request after a redirect. This guard
          // therefore examines each redirect from the application.
          const response = await route.fetch({ maxRedirects: 0 });
          const location = response.headers()["location"];
          const target = location === undefined ? undefined : new URL(location, url);
          if (target === undefined || target.origin === allowedOrigin) return route.fulfill({ response });
          const answer = externalRedirects.answer(target);
          if (answer === undefined) {
            blocked.push(target.href);
            return route.abort("blockedbyclient");
          }
          return route.fulfill({ response, headers: { ...response.headers(), location: answer } });
        },
      );
      await use();
      expect(blocked, "The page sent requests to an external host").toEqual([]);
    },
    { auto: true },
  ],
});

// The Spotify authorisation page sends the browser back to the redirect URI.
function callback(authorisation: URL, answer: SpotifyAnswer): string {
  const target = new URL(authorisation.searchParams.get("redirect_uri")!);
  target.searchParams.set("state", authorisation.searchParams.get("state")!);
  if (answer === "agree") target.searchParams.set("code", "fake-authorisation-code");
  else target.searchParams.set("error", "access_denied");
  return target.href;
}

async function expectOk(response: Promise<{ ok(): boolean; status(): number }>): Promise<void> {
  const result = await response;
  expect(result.ok(), `The test server control request gave status ${result.status()}`).toBe(true);
}

export { expect };
