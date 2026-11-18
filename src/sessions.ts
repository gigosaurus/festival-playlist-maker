import { createHash, randomBytes } from "node:crypto";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import type { Settings } from "./settings.ts";
import type { SpotifyAccount } from "./spotify-log-in.ts";

export interface User {
  id: number;
  spotifyUserId: string;
  displayName: string;
  admin: boolean;
}

export interface SessionStart {
  // The browser keeps the token in a cookie. The database keeps only its hash.
  token: string;
  expiresAt: Date;
}

export interface FoundSession {
  user: User;
  // Set when the session got a new expiry time. The browser cookie needs the same time.
  renewedUntil?: Date;
}

const day = 24 * 60 * 60 * 1000;
// A session stays for one year after the last use. Browsers keep a cookie for a
// maximum of 400 days.
export const sessionLifetime = 365 * day;
// The application changes the expiry time a maximum of one time each day.
const renewalInterval = day;

export interface Sessions {
  // Adds the user, or updates the display name and the refresh token, and starts a session.
  logIn(account: SpotifyAccount): SessionStart;
  // Gives the user of a session that has not expired, or undefined.
  find(token: string): FoundSession | undefined;
  logOut(token: string): void;
}

export function createSessions(database: Database, clock: Clock, settings: Settings): Sessions {
  const saveUser = database.prepare(
    `INSERT INTO user (spotify_user_id, display_name, refresh_token) VALUES (?, ?, ?)
     ON CONFLICT (spotify_user_id) DO UPDATE
       SET display_name = excluded.display_name, refresh_token = excluded.refresh_token
     RETURNING id`,
  );
  const insertSession = database.prepare("INSERT INTO session (token_hash, user_id, expires_at) VALUES (?, ?, ?)");
  const selectSession = database.prepare(
    `SELECT user.id, user.spotify_user_id, user.display_name, session.expires_at
     FROM session JOIN user ON user.id = session.user_id
     WHERE session.token_hash = ?`,
  );
  const renewSession = database.prepare("UPDATE session SET expires_at = ? WHERE token_hash = ?");
  const deleteSession = database.prepare("DELETE FROM session WHERE token_hash = ?");
  const deleteExpiredSessions = database.prepare("DELETE FROM session WHERE expires_at <= ?");

  return {
    logIn(account) {
      const { id } = saveUser.get(account.spotifyUserId, account.displayName, account.refreshToken) as { id: number };
      const now = clock.now();
      deleteExpiredSessions.run(now.toISOString());
      const token = randomBytes(32).toString("base64url");
      const expiresAt = new Date(now.getTime() + sessionLifetime);
      insertSession.run(hash(token), id, expiresAt.toISOString());
      return { token, expiresAt };
    },

    find(token) {
      const row = selectSession.get(hash(token)) as
        | { id: number; spotify_user_id: string; display_name: string; expires_at: string }
        | undefined;
      if (row === undefined) return undefined;
      const now = clock.now().getTime();
      const expiresAt = new Date(row.expires_at).getTime();
      if (expiresAt <= now) {
        deleteSession.run(hash(token));
        return undefined;
      }
      const user: User = {
        id: row.id,
        spotifyUserId: row.spotify_user_id,
        displayName: row.display_name,
        admin: row.spotify_user_id === settings.adminSpotifyUserId,
      };
      if (now + sessionLifetime - expiresAt < renewalInterval) return { user };
      const renewedUntil = new Date(now + sessionLifetime);
      renewSession.run(renewedUntil.toISOString(), hash(token));
      return { user, renewedUntil };
    },

    logOut(token) {
      deleteSession.run(hash(token));
    },
  };
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
