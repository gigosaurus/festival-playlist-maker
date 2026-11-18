import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { openDatabase } from "../../src/database.ts";
import { createSessions, sessionLifetime } from "../../src/sessions.ts";
import { FakeClock } from "../support/fake-clock.ts";
import { temporaryDatabasePath } from "../support/temporary-database.ts";
import { adminSpotifyUserId, testSettings } from "../support/test-settings.ts";

const day = 24 * 60 * 60 * 1000;

function setUp(t: TestContext) {
  const path = temporaryDatabasePath(t);
  const database = openDatabase(path);
  t.after(() => database.close());
  const clock = new FakeClock();
  return { path, database, clock, sessions: createSessions(database, clock, testSettings()) };
}

const alex = { spotifyUserId: "alex", displayName: "Alex", refreshToken: "refresh-1" };

test("a session gives its user after the log in", (t) => {
  const { sessions } = setUp(t);

  const session = sessions.logIn(alex);

  const found = sessions.find(session.token);
  assert.deepEqual(found?.user, { id: found!.user.id, spotifyUserId: "alex", displayName: "Alex", admin: false });
});

test("the configured Spotify account gets the admin role, and other users do not", (t) => {
  const { sessions } = setUp(t);

  const admin = sessions.logIn({ spotifyUserId: adminSpotifyUserId, displayName: "Kit", refreshToken: "r" });
  const user = sessions.logIn(alex);

  assert.equal(sessions.find(admin.token)?.user.admin, true);
  assert.equal(sessions.find(user.token)?.user.admin, false);
});

test("the database stores the refresh token, and a new log in replaces it", (t) => {
  const { database, sessions } = setUp(t);

  sessions.logIn(alex);
  sessions.logIn({ ...alex, displayName: "Alex B", refreshToken: "refresh-2" });

  assert.deepEqual(
    database.prepare("SELECT spotify_user_id, display_name, refresh_token FROM user").all().map((row) => ({ ...row })),
    [{ spotify_user_id: "alex", display_name: "Alex B", refresh_token: "refresh-2" }],
  );
});

test("the database does not store the session token", (t) => {
  const { database, sessions } = setUp(t);

  const { token } = sessions.logIn(alex);

  const stored = JSON.stringify(database.prepare("SELECT * FROM session").all());
  assert.ok(!stored.includes(token));
});

test("a session stays when the application starts again", (t) => {
  const path = temporaryDatabasePath(t);
  const clock = new FakeClock();
  const first = openDatabase(path);
  const { token } = createSessions(first, clock, testSettings()).logIn(alex);
  first.close();

  const reopened = openDatabase(path);
  t.after(() => reopened.close());

  assert.equal(createSessions(reopened, clock, testSettings()).find(token)?.user.spotifyUserId, "alex");
});

test("a session ends after one year without use", (t) => {
  const { clock, sessions } = setUp(t);
  const { token, expiresAt } = sessions.logIn(alex);
  assert.equal(expiresAt.getTime(), clock.now().getTime() + sessionLifetime);

  clock.advance(sessionLifetime);

  assert.equal(sessions.find(token), undefined);
});

test("a session that the user uses gets a new expiry time, a maximum of one time each day", (t) => {
  const { clock, sessions } = setUp(t);
  const { token } = sessions.logIn(alex);

  clock.advance(day / 2);
  assert.equal(sessions.find(token)?.renewedUntil, undefined);

  clock.advance(day);
  const renewed = sessions.find(token)?.renewedUntil;
  assert.equal(renewed?.getTime(), clock.now().getTime() + sessionLifetime);

  clock.advance(sessionLifetime - day);
  assert.ok(sessions.find(token), "The renewed session stays after the first expiry time");
});

test("log out ends only that session", (t) => {
  const { sessions } = setUp(t);
  const phone = sessions.logIn(alex);
  const laptop = sessions.logIn(alex);

  sessions.logOut(phone.token);

  assert.equal(sessions.find(phone.token), undefined);
  assert.equal(sessions.find(laptop.token)?.user.spotifyUserId, "alex");
});

test("an unknown token gives no session", (t) => {
  const { sessions } = setUp(t);

  assert.equal(sessions.find("not-a-token"), undefined);
});
