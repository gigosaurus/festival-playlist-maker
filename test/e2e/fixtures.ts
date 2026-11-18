import { test as base, expect } from "@playwright/test";

export interface TestServer {
  setTime(now: Date): Promise<void>;
  time(): Promise<Date>;
  sentHttpRequests(): Promise<{ method: string; url: string }[]>;
}

// Each test starts with reset fakes. The browser can load only pages and files
// from the test server. A request to a different host fails the test.
export const test = base.extend<{ testServer: TestServer; externalRequestGuard: void }>({
  testServer: async ({ request }, use) => {
    await expectOk(request.post("/__test/reset"));
    await use({
      setTime: (now) => expectOk(request.post("/__test/clock", { data: { now: now.toISOString() } })),
      time: async () => new Date((await (await request.get("/__test/clock")).json()).now),
      sentHttpRequests:async () => (await request.get("/__test/http-requests")).json(),
    });
  },
  externalRequestGuard: [
    async ({ page, baseURL }, use) => {
      const allowedOrigin = new URL(baseURL!).origin;
      const blocked: string[] = [];
      await page.route(
        (url) => url.origin !== allowedOrigin && url.protocol !== "data:",
        (route) => {
          blocked.push(route.request().url());
          return route.abort("blockedbyclient");
        },
      );
      await use();
      expect(blocked, "The page sent requests to an external host").toEqual([]);
    },
    { auto: true },
  ],
});

async function expectOk(response: Promise<{ ok(): boolean; status(): number }>): Promise<void> {
  const result = await response;
  expect(result.ok(), `The test server control request gave status ${result.status()}`).toBe(true);
}

export { expect };
