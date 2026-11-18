import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  clashfinderCrawlDelay,
  clashfinderRequestLimit,
  RequestLimitError,
  withServiceRules,
  type HttpClient,
} from "../../src/http-client.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { testSettings } from "../support/test-settings.ts";

const exportUrl = "https://clashfinder.com/data/event/download27.json";

function setUp() {
  const transport = new FakeHttpClient();
  const clock = new FakeClock();
  const client = withServiceRules(transport, testSettings(), clock);
  return { transport, clock, client };
}

// The fake gives status 200 to each request, and records it.
function respondToAll(transport: FakeHttpClient): void {
  transport.send = async (request) => {
    transport.requests.push({ method: request.method, url: request.url });
    return new Response("{}");
  };
}

test("the HTTP client signs each Clashfinder request with the username and the public key", async () => {
  const { transport, client } = setUp();
  respondToAll(transport);

  await client.send(new Request(`${exportUrl}?user=someone`));

  const sent = new URL(transport.requests[0]!.url);
  assert.equal(sent.origin + sent.pathname, exportUrl);
  assert.equal(sent.searchParams.get("user"), "someone");
  assert.equal(sent.searchParams.get("authUsername"), "test-clashfinder-user");
  // The public key is the SHA-256 hash of the username and the private key, in hexadecimal.
  const expected = createHash("sha256").update("test-clashfinder-usertest-clashfinder-private-key").digest("hex");
  assert.equal(sent.searchParams.get("authPublicKey"), expected);
  assert.ok(!transport.requests[0]!.url.includes("test-clashfinder-private-key"), "The private key is not in the request");
});

test("the HTTP client does not sign requests to other services", async () => {
  const { transport, client } = setUp();
  respondToAll(transport);

  await client.send(new Request("https://api.spotify.com/v1/me"));

  assert.equal(transport.requests[0]!.url, "https://api.spotify.com/v1/me");
});

test("the HTTP client waits for the crawl delay between Clashfinder requests", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);

  await client.send(new Request(exportUrl));
  clock.advance(3_000);
  await client.send(new Request(exportUrl));
  clock.advance(clashfinderCrawlDelay);
  await client.send(new Request(exportUrl));

  assert.equal(clashfinderCrawlDelay, 10_000);
  assert.deepEqual(clock.sleeps, [7_000], "Only the second request waits, for the remainder of the 10 seconds");
  assert.equal(transport.requests.length, 3);
});

test("the HTTP client sends one Clashfinder request at a time", async () => {
  const clock = new FakeClock();
  const events: string[] = [];
  const transport: HttpClient = {
    async send(request) {
      const name = new URL(request.url).pathname;
      events.push(`start ${name}`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      events.push(`end ${name}`);
      return new Response("{}");
    },
  };
  const client = withServiceRules(transport, testSettings(), clock);

  await Promise.all([
    client.send(new Request("https://clashfinder.com/data/event/a.json")),
    client.send(new Request("https://clashfinder.com/data/event/b.json")),
  ]);

  assert.deepEqual(events, [
    "start /data/event/a.json",
    "end /data/event/a.json",
    "start /data/event/b.json",
    "end /data/event/b.json",
  ]);
  assert.deepEqual(clock.sleeps, [clashfinderCrawlDelay]);
});

test("the HTTP client refuses a Clashfinder request above the limit of 10 requests in 5 minutes", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);
  for (let index = 0; index < clashfinderRequestLimit.requests; index++) {
    await client.send(new Request(exportUrl));
  }

  await assert.rejects(client.send(new Request(exportUrl)), (error) => {
    assert.ok(error instanceof RequestLimitError);
    assert.match(error.message, /maximum of 10 requests to Clashfinder in 5 minutes\. Try again in 4 minutes\./);
    return true;
  });
  assert.equal(transport.requests.length, 10, "The refused request is not sent");

  clock.advance(5 * 60_000);
  await client.send(new Request(exportUrl));
  assert.equal(transport.requests.length, 11);
});

test("a failed Clashfinder request does not stop the next request", async () => {
  const { transport, client } = setUp();
  let first = true;
  transport.send = async () => {
    if (first) {
      first = false;
      throw new Error("Network failure");
    }
    return new Response("{}");
  };

  await assert.rejects(client.send(new Request(exportUrl)), /Network failure/);
  const response = await client.send(new Request(exportUrl));

  assert.equal(response.status, 200);
});
