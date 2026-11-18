import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { csrf } from "hono/csrf";
import {
  createArtistSearchQueue,
  festivalArtistMatches,
  festivalLineupName,
  findArtistMatch,
  saveArtistMatch,
  storedSearch,
  storeSearch,
  type ArtistChoice,
} from "./artist-matches.ts";
import { createClashfinder } from "./clashfinder.ts";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { readFestivalForm, searchDates, validateFestival, type FestivalFormValues, type FieldProblems } from "./festival-form.ts";
import { addFestival, findFestivalForAdmin, listFestivalsForAdmin, listPublishedFestivals } from "./festivals.ts";
import { withServiceRules, type HttpClient } from "./http-client.ts";
import { getFestivalLineup } from "./lineups.ts";
import { createMusicBrainz } from "./musicbrainz.ts";
import { artistMatchPage, type ArtistMatchPageState } from "./pages/artist-match-page.ts";
import { artistMatchesPage } from "./pages/artist-matches-page.ts";
import { addFestivalPage, type AddFestivalPageState } from "./pages/add-festival-page.ts";
import { adminFestivalsPage, type LastAction } from "./pages/admin-festivals-page.ts";
import { adminOnlyPage } from "./pages/admin-only-page.ts";
import { festivalsPage } from "./pages/festivals-page.ts";
import { isLogInProblem, logInPage, type LogInProblem } from "./pages/log-in-page.ts";
import { notFoundPage } from "./pages/not-found-page.ts";
import { createSessions, type User } from "./sessions.ts";
import type { Settings } from "./settings.ts";
import { completeSpotifyLogIn, startSpotifyLogIn } from "./spotify-log-in.ts";

// The application gets all of its connections to the outside world here.
// main.ts gives the real ones. The tests give a fake HTTP client and a fake clock.
// The application adds the rules of each service (keys, pauses) to the HTTP client.
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

export function createApp({ database, httpClient: transport, clock, settings }: Dependencies): Hono<Environment> {
  const app = new Hono<Environment>();
  const httpClient = withServiceRules(transport, settings, clock);
  const clashfinder = createClashfinder(httpClient, clock);
  const musicBrainz = createMusicBrainz(httpClient);
  const artistSearches = createArtistSearchQueue(database, musicBrainz, clock);
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

  // All pages in the admin area need the admin.
  app.use("/admin/*", async (context, next) => {
    const user = context.var.user!;
    if (!user.admin) return context.html(adminOnlyPage(user), 403);
    await next();
  });

  app.get("/admin/festivals", (context) => {
    const festivals = listFestivalsForAdmin(database);
    const unmatched = new Map(
      festivals.map((festival) => [festival.id, festivalArtistMatches(database, festival.id).filter((name) => !name.match).length]),
    );
    return context.html(adminFestivalsPage(context.var.user!, festivals, readLastAction(context.req.query(), festivals), unmatched));
  });

  // The search is a GET request, so that Back, refresh and the address show the same results.
  app.get("/admin/festivals/new", async (context) => {
    const query = context.req.query();
    const values = readFestivalForm(query);
    const searched = "search" in query;
    return context.html(addFestivalPage(context.var.user!, await formState(values, {}, searched)));
  });

  app.post("/admin/festivals", async (context) => {
    const values = readFestivalForm(await context.req.parseBody());
    const validation = validateFestival(values);
    if ("problems" in validation) {
      return context.html(addFestivalPage(context.var.user!, await formState(values, validation.problems, true)), 400);
    }
    const { festival } = validation;
    const pageName = clashfinder.cachedPage(festival.page)?.name ?? festival.page;
    const added = addFestival(database, festival, { source: "clashfinder", page: festival.page, pageName });
    if (added.outcome === "exists") {
      const problems = { name: `${festival.name} ${festival.year} is already on the festival list. Enter a different name or year.` };
      return context.html(addFestivalPage(context.var.user!, await formState(values, problems, true)), 400);
    }
    await getLineupAndSearch(added.id);
    return context.redirect(`/admin/festivals?added=${added.id}`, 303);
  });

  app.post("/admin/festivals/:id/lineup", async (context) => {
    const id = Number(context.req.param("id"));
    if (!Number.isSafeInteger(id) || findFestivalForAdmin(database, id) === undefined) {
      return context.html(notFoundPage(context.var.user!), 404);
    }
    await getLineupAndSearch(id);
    return context.redirect(`/admin/festivals?lineup=${id}`, 303);
  });

  app.get("/admin/festivals/:id/artist-matches", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    let names = festivalArtistMatches(database, festival.id);
    // Opening the page starts the searches that are not complete, except after a failure.
    // After a failure, the admin starts them again with "Search again".
    const queue = artistSearches.state();
    if (!queue.running && queue.problem === undefined && names.some((name) => !name.match && !name.search)) {
      artistSearches.searchFestival(festival.id);
      names = festivalArtistMatches(database, festival.id);
    }
    const savedId = Number(context.req.query("saved"));
    const saved = Number.isSafeInteger(savedId) ? festivalLineupName(database, festival.id, savedId) : undefined;
    return context.html(
      artistMatchesPage(context.var.user!, { festival, names, queue: artistSearches.state(), ...(saved ? { saved } : {}) }),
    );
  });

  app.post("/admin/festivals/:id/artist-matches/search", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    artistSearches.searchFestival(festival.id);
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches`, 303);
  });

  // A search with a different text is a GET request, so that Back, refresh and the address show the same results.
  app.get("/admin/festivals/:id/artist-matches/:lineupNameId", async (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    const name = festival && festivalLineupName(database, festival.id, Number(context.req.param("lineupNameId")));
    if (festival === undefined || name === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const text = context.req.query("search")?.replace(/\s+/g, " ").trim() || name.name;
    const fresh = context.req.query("search") !== undefined;
    return context.html(artistMatchPage(context.var.user!, { festival, name, searchText: text, search: await search(text, fresh) }));
  });

  app.post("/admin/festivals/:id/artist-matches", async (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    const form = await context.req.parseBody();
    const name = festival && festivalLineupName(database, festival.id, Number(form.lineupName));
    if (festival === undefined || name === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const text = typeof form.search === "string" && form.search.trim() !== "" ? form.search.trim() : name.name;
    const choice = readChoice(name.name, text, form.choice);
    if (choice === undefined) {
      const state: ArtistMatchPageState = {
        festival,
        name,
        searchText: text,
        search: await search(text, false),
        problem: "Choose an artist or “No match”.",
      };
      return context.html(artistMatchPage(context.var.user!, state), 400);
    }
    saveArtistMatch(database, clock, name.name, choice);
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches?saved=${name.lineupNameId}`, 303);
  });

  app.get("/", (context) => context.html(festivalsPage(context.var.user!, listPublishedFestivals(database))));

  app.notFound((context) => context.html(notFoundPage(context.var.user!), 404));

  return app;

  // After a new lineup, the searches for the new names start in the background.
  async function getLineupAndSearch(festivalId: number): Promise<void> {
    const result = await getFestivalLineup(database, clashfinder, clock, festivalId);
    if (result.outcome === "got") artistSearches.searchFestival(festivalId);
  }

  // The stored search for a text, or a new search when there is none or when `fresh` is true.
  async function search(text: string, fresh: boolean): Promise<ArtistMatchPageState["search"]> {
    const stored = fresh ? undefined : storedSearch(database, text);
    if (stored !== undefined) return { outcome: "found", search: stored };
    const result = await musicBrainz.searchArtists(text);
    if (result.outcome === "failed") return result;
    return { outcome: "found", search: storeSearch(database, clock, text, result.artists) };
  }

  // The chosen artist comes from the stored search, so that the form cannot save
  // artist data that MusicBrainz did not give. The current match is also a choice.
  function readChoice(name: string, text: string, value: unknown): ArtistChoice | undefined {
    if (value === "no-match") return { kind: "no-match" };
    if (typeof value !== "string") return undefined;
    const current = findArtistMatch(database, name);
    if (current?.kind === "artist" && current.artist.id === value) return { kind: "artist", artist: current.artist };
    const artist = storedSearch(database, text)?.artists.find((each) => each.id === value);
    return artist === undefined ? undefined : { kind: "artist", artist };
  }

  // The search uses the search text, or the festival name when the search text is empty.
  // After the first search, the list of pages comes from the cache of the Clashfinder module.
  async function formState(values: FestivalFormValues, problems: FieldProblems, searched: boolean): Promise<AddFestivalPageState> {
    const text = values.search || values.name;
    if (!searched || text === "") {
      if (searched && text === "" && Object.keys(problems).length === 0) {
        return { values, problems: { name: "Enter the name of the festival, or a search text." } };
      }
      return { values, problems };
    }
    const dates = searchDates(values);
    return { values, problems, search: { text, result: await clashfinder.search(text, dates), hasDates: dates !== undefined } };
  }

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

// The confirmation or the problem after an action on the festival list. The
// page reads the result from the database, so it shows the actual state (FN-02).
function readLastAction(query: Record<string, string>, festivals: ReturnType<typeof listFestivalsForAdmin>): LastAction | undefined {
  const [action, value] =
    query.added !== undefined ? (["added", query.added] as const) : query.lineup !== undefined ? (["got-lineup", query.lineup] as const) : [];
  if (action === undefined) return undefined;
  const festival = festivals.find((each) => String(each.id) === value);
  return festival === undefined ? undefined : { action, festival };
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
