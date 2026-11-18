import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { listPublishedFestivals } from "./festivals.ts";
import type { HttpClient } from "./http-client.ts";
import { adminOnlyPage } from "./pages/admin-only-page.ts";
import { festivalsPage } from "./pages/festivals-page.ts";
import { isLogInProblem, logInPage, type LogInProblem } from "./pages/log-in-page.ts";
import { notFoundPage } from "./pages/not-found-page.ts";
import { createSessions, type User } from "./sessions.ts";
import type { Settings } from "./settings.ts";
import { completeSpotifyLogIn, startSpotifyLogIn } from "./spotify-log-in.ts";

// The application gets all of its connections to the outside world here.
// main.ts gives the real ones. The tests give a fake HTTP client and a fake clock.
export interface Dependencies {
  database: Database;
  httpClient: HttpClient;
  clock: Clock;
  settings: Settings;
}

interface Environment {
  Variables: { user?: User; sessionToken?: string };
}

const publicDirectory = join(import.meta.dirname, "public");
const staticFiles = {
  "/styles.css": { type: "text/css; charset=utf-8", body: readFileSync(join(publicDirectory, "styles.css")) },
  "/favicon.svg": { type: "image/svg+xml", body: readFileSync(join(publicDirectory, "favicon.svg")) },
};

const sessionCookie = "session";
// Keeps the PKCE values from the start of a log in until Spotify sends the browser back.
const logInCookie = "log_in";
const logInCookieLifetimeSeconds = 10 * 60;

interface PendingLogIn {
  state: string;
  codeVerifier: string;
  next: string;
}

export function createApp({ database, httpClient, clock, settings }: Dependencies): Hono<Environment> {
  const app = new Hono<Environment>();
  const sessions = createSessions(database, clock, settings);
  const applicationOrigin = new URL(settings.spotifyRedirectUri).origin;
  // Browsers send a Secure cookie only over HTTPS. A local installation uses HTTP.
  const secure = applicationOrigin.startsWith("https:");

  for (const [path, file] of Object.entries(staticFiles)) {
    app.get(path, (context) => context.body(file.body, 200, { "content-type": file.type }));
  }

  // Forms on a different website cannot send a request with the cookies of the user.
  app.use(
    csrf({
      origin: (origin, context) => origin === applicationOrigin || origin === new URL(context.req.url).origin,
    }),
  );

  app.use(async (context, next) => {
    const token = getCookie(context, sessionCookie);
    const found = token === undefined ? undefined : sessions.find(token);
    if (found) {
      context.set("user", found.user);
      context.set("sessionToken", token);
      if (found.renewedUntil) setSessionCookie(context, token!, found.renewedUntil);
    }
    await next();
  });

  app.get("/log-in", (context) => {
    const next = localAddress(context.req.query("next"));
    if (context.var.user) return context.redirect(next, 303);
    const problem = context.req.query("problem");
    return context.html(logInPage(isLogInProblem(problem) ? problem : undefined, next));
  });

  app.post("/log-in", async (context) => {
    const form = await context.req.parseBody();
    const next = localAddress(typeof form.next === "string" ? form.next : undefined);
    const { authoriseUrl, state, codeVerifier } = startSpotifyLogIn(settings);
    const pending: PendingLogIn = { state, codeVerifier, next };
    setCookie(context, logInCookie, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
      path: "/log-in",
      httpOnly: true,
      // Lax: the browser sends the cookie when Spotify sends it back to the callback address.
      sameSite: "Lax",
      secure,
      maxAge: logInCookieLifetimeSeconds,
    });
    return context.redirect(authoriseUrl, 303);
  });

  app.get("/log-in/callback", async (context) => {
    const pending = readPendingLogIn(getCookie(context, logInCookie));
    deleteCookie(context, logInCookie, { path: "/log-in", secure });
    const next = pending?.next ?? "/";
    const showProblem = (problem: LogInProblem) => {
      const query = new URLSearchParams({ problem });
      if (next !== "/") query.set("next", next);
      return context.redirect(`/log-in?${query}`, 303);
    };

    const { code, state, error } = context.req.query();
    if (error === "access_denied") return showProblem("cancelled");
    if (error !== undefined || code === undefined || pending === undefined || state !== pending.state) {
      console.error(`A log in did not complete. Spotify error: ${error ?? "none"}. Log in values found: ${pending !== undefined}.`);
      return showProblem("failed");
    }

    const result = await completeSpotifyLogIn(httpClient, settings, code, pending.codeVerifier);
    if (result.outcome === "not-on-allowlist") return showProblem("not-on-allowlist");
    if (result.outcome === "failed") {
      console.error(`A log in did not complete. ${result.cause}`);
      return showProblem("failed");
    }
    const session = sessions.logIn(result.account);
    setSessionCookie(context, session.token, session.expiresAt);
    return context.redirect(next, 303);
  });

  app.post("/log-out", (context) => {
    const token = context.var.sessionToken;
    if (token !== undefined) sessions.logOut(token);
    deleteCookie(context, sessionCookie, { path: "/", secure });
    return context.redirect("/log-in", 303);
  });

  // All pages after this point need a logged-in user.
  app.use(async (context, next) => {
    if (!context.var.user) {
      const url = new URL(context.req.url);
      const next = localAddress(url.pathname + url.search);
      return context.redirect(next === "/" ? "/log-in" : `/log-in?${new URLSearchParams({ next })}`, 303);
    }
    await next();
  });

  // All pages in the admin area need the admin. The admin pages come in later changes.
  app.use("/admin/*", async (context, next) => {
    const user = context.var.user!;
    if (!user.admin) return context.html(adminOnlyPage(user), 403);
    await next();
  });

  app.get("/", (context) => context.html(festivalsPage(context.var.user!, listPublishedFestivals(database))));

  app.notFound((context) => context.html(notFoundPage(context.var.user!), 404));

  return app;

  // The cookie gets a lifetime and not an expiry time, because the clock of the
  // browser can be different from the injected clock.
  function setSessionCookie(context: Context, token: string, expiresAt: Date): void {
    setCookie(context, sessionCookie, token, {
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure,
      maxAge: Math.floor((expiresAt.getTime() - clock.now().getTime()) / 1000),
    });
  }
}

// Only an address on this application can follow a log in. This prevents a
// link that sends a user to a different website after the log in.
function localAddress(value: string | undefined): string {
  if (value === undefined || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (value.startsWith("/log-in") || value.startsWith("/log-out")) return "/";
  return value;
}

function readPendingLogIn(value: string | undefined): PendingLogIn | undefined {
  if (value === undefined) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<PendingLogIn>;
    if (typeof parsed.state !== "string" || typeof parsed.codeVerifier !== "string") return undefined;
    return { state: parsed.state, codeVerifier: parsed.codeVerifier, next: localAddress(parsed.next) };
  } catch {
    return undefined;
  }
}
