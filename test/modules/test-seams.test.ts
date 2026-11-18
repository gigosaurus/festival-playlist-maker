import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeClock } from "../support/fake-clock.ts";
import { FakeHttpClient } from "../support/fake-http-client.ts";

test("the test run cannot send a network request", async () => {
  await assert.rejects(fetch("https://api.spotify.com/v1/me"), /tried to send a network request/);
});

test("FakeHttpClient gives the recorded response and records the request", async () => {
  const client = new FakeHttpClient();
  client.respondTo("GET", "https://musicbrainz.org/ws/2/artist?query=Gojira", {
    status: 200,
    headers: { "content-type": "application/json" },
    body: '{"artists":[]}',
  });

  const response = await client.send(new Request("https://musicbrainz.org/ws/2/artist?query=Gojira"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { artists: [] });
  assert.deepEqual(client.requests, [
    { method: "GET", url: "https://musicbrainz.org/ws/2/artist?query=Gojira" },
  ]);
});

test("FakeHttpClient fails a request that has no recorded response", async () => {
  const client = new FakeHttpClient();

  await assert.rejects(
    client.send(new Request("https://api.setlist.fm/rest/1.0/search/setlists")),
    /no recorded response for GET https:\/\/api.setlist.fm/,
  );
});

test("FakeClock gives the time that the test sets", () => {
  const clock = new FakeClock(new Date("2027-06-01T09:00:00Z"));
  clock.advance(24 * 60 * 60 * 1000);
  assert.equal(clock.now().toISOString(), "2027-06-02T09:00:00.000Z");

  clock.set(new Date("2027-08-01T00:00:00Z"));
  assert.equal(clock.now().toISOString(), "2027-08-01T00:00:00.000Z");
});
