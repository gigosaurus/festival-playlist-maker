import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import {
  clashfinderCrawlDelay,
  clashfinderRequestLimit,
  RequestLimitError,
  setlistFmLimitWait,
  setlistFmRequestDelay,
  setlistFmRequestLimit,
  spotifyLongestWait,
  spotifyRequestDelay,
  SpotifyQuotaError,
  withServiceRules,
  type HttpClient,
} from "../../src/http-client.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";
import { quotaExceededResponse, rateLimitResponse } from "../support/spotify.ts";
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

const spotifyArtist = "https://api.spotify.com/v1/artists/1Ffb6ejR6Fe5IamqA5oRUF";

test("the HTTP client waits for the pause between Spotify requests", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);

  await client.send(new Request(spotifyArtist));
  await client.send(new Request(spotifyArtist));
  clock.advance(spotifyRequestDelay);
  await client.send(new Request(spotifyArtist));

  assert.deepEqual(clock.sleeps, [spotifyRequestDelay]);
  assert.equal(transport.requests.length, 3);
});

test("after status 429, the HTTP client waits for Retry-After and sends the Spotify request again", async () => {
  const { transport, clock, client } = setUp();
  transport.respondTo("GET", spotifyArtist, rateLimitResponse(5));
  const send = transport.send.bind(transport);
  transport.send = async (request) => {
    const response = await send(request);
    transport.respondTo("GET", spotifyArtist, { body: "{}" });
    return response;
  };

  const response = await client.send(new Request(spotifyArtist));

  assert.equal(response.status, 200);
  assert.equal(transport.requests.length, 2);
  assert.deepEqual(clock.sleeps, [5_000]);
});

test("after a long Retry-After, the HTTP client refuses the Spotify requests until the wait is complete", async () => {
  const { transport, clock, client } = setUp();
  transport.respondTo("GET", spotifyArtist, rateLimitResponse(600));

  await assert.rejects(client.send(new Request(spotifyArtist)), (error) => {
    assert.ok(error instanceof RequestLimitError);
    assert.equal(error.message, "Spotify limited the requests of the application (status 429). Try again in 10 minutes.");
    return true;
  });
  clock.advance(spotifyLongestWait);
  await assert.rejects(client.send(new Request(spotifyArtist)), /Try again in 9 minutes\./);
  assert.equal(transport.requests.length, 1, "The HTTP client does not send a request during the wait");

  transport.respondTo("GET", spotifyArtist, { body: "{}" });
  clock.advance(9 * 60_000);
  assert.equal((await client.send(new Request(spotifyArtist))).status, 200);
  assert.deepEqual(clock.sleeps, [], "The HTTP client does not wait for minutes");
});

test("the HTTP client reports a Spotify quota error with its cause and does not send the request again", async () => {
  const { transport, clock, client } = setUp();
  transport.respondTo("GET", spotifyArtist, quotaExceededResponse);

  await assert.rejects(client.send(new Request(spotifyArtist)), (error) => {
    assert.ok(error instanceof SpotifyQuotaError);
    assert.match(error.message, /used all of its Spotify quota \(status 429, QUOTA_EXCEEDED\)/);
    return true;
  });

  assert.equal(transport.requests.length, 1);
  assert.deepEqual(clock.sleeps, []);
});

test("the HTTP client does not pace the Spotify log in requests", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);

  await client.send(new Request("https://accounts.spotify.com/api/token", { method: "POST" }));
  await client.send(new Request("https://accounts.spotify.com/api/token", { method: "POST" }));

  assert.deepEqual(clock.sleeps, []);
});

const setlists = "https://api.setlist.fm/rest/1.0/artist/074e3847-f67f-49f9-81f1-8c8cea147e8e/setlists?p=1";

test("the HTTP client sends the setlist.fm API key and asks for JSON", async () => {
  const { transport, client } = setUp();
  const headers: Headers[] = [];
  transport.send = async (request) => {
    headers.push(request.headers);
    return new Response("{}");
  };

  await client.send(new Request(setlists));
  await client.send(new Request("https://musicbrainz.org/ws/2/artist?query=Gojira"));

  assert.equal(headers[0]!.get("x-api-key"), "test-setlist-fm-key");
  assert.equal(headers[0]!.get("accept"), "application/json");
  assert.equal(headers[1]!.get("x-api-key"), null, "Other services do not get the setlist.fm API key");
});

test("the HTTP client waits for the pause between setlist.fm requests", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);

  await client.send(new Request(setlists));
  await client.send(new Request(setlists));

  assert.deepEqual(clock.sleeps, [setlistFmRequestDelay]);
});

test("the HTTP client refuses a setlist.fm request above the limit of 1,440 requests in 24 hours", async () => {
  const { transport, clock, client } = setUp();
  respondToAll(transport);
  for (let index = 0; index < setlistFmRequestLimit.requests; index++) {
    await client.send(new Request(setlists));
  }

  await assert.rejects(client.send(new Request(setlists)), (error) => {
    assert.ok(error instanceof RequestLimitError);
    assert.match(error.message, /maximum of 1,440 requests to setlist\.fm in 24 hours\. Try again in 24 hours\./);
    return true;
  });
  assert.equal(transport.requests.length, 1_440, "The refused request is not sent");

  clock.advance(24 * 60 * 60_000);
  await client.send(new Request(setlists));
  assert.equal(transport.requests.length, 1_441);
});

test("after status 429 from setlist.fm, the HTTP client gives the time of the next possible request", async () => {
  const { transport, clock, client } = setUp();
  transport.respondTo("GET", setlists, { status: 429, body: "{}" });
  const start = clock.now().getTime();

  await assert.rejects(client.send(new Request(setlists)), (error) => {
    assert.ok(error instanceof RequestLimitError);
    assert.equal(error.retryAt.getTime(), start + setlistFmLimitWait, "Without Retry-After, the wait is the default wait");
    return true;
  });

  transport.respondTo("GET", setlists, { status: 429, headers: { "retry-after": "5" }, body: "{}" });
  await assert.rejects(client.send(new Request(setlists)), (error) => {
    assert.ok(error instanceof RequestLimitError);
    assert.equal(error.retryAt.getTime(), clock.now().getTime() + 5_000);
    return true;
  });
});
