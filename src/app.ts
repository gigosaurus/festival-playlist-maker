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
  type ArtistMatch,
} from "./artist-matches.ts";
import { createClashfinder } from "./clashfinder.ts";
import type { Clock } from "./clock.ts";
import type { Database } from "./database.ts";
import { readFestivalForm, searchDates, validateFestival, type FestivalFormValues, type FieldProblems } from "./festival-form.ts";
import {
  addFestival,
  findFestivalForAdmin,
  findPublishedFestival,
  listFestivalsForAdmin,
  listPublishedFestivals,
  londonDate,
  publishFestival,
} from "./festivals.ts";
import { withServiceRules, type HttpClient } from "./http-client.ts";
import { isInterestLevel, saveInterestLevels, type InterestLevel } from "./interest-levels.ts";
import { getFestivalLineup } from "./lineups.ts";
import { createMusicBrainz, type MusicBrainzArtist } from "./musicbrainz.ts";
import { artistMatchPage, type ArtistMatchPageState } from "./pages/artist-match-page.ts";
import { artistMatchesPage } from "./pages/artist-matches-page.ts";
import { addFestivalPage, type AddFestivalPageState } from "./pages/add-festival-page.ts";
import { adminFestivalsPage, type LastAction } from "./pages/admin-festivals-page.ts";
import { adminOnlyPage } from "./pages/admin-only-page.ts";
import { festivalPage } from "./pages/festival-page.ts";
import { festivalsPage } from "./pages/festivals-page.ts";
import { isLogInProblem, logInPage, type LogInProblem } from "./pages/log-in-page.ts";
import { notFoundPage } from "./pages/not-found-page.ts";
import { predictedSongsPage } from "./pages/predicted-songs-page.ts";
import { spotifyArtistPage } from "./pages/spotify-artist-page.ts";
import { createPlaylistBuilder, festivalsWithPlaylist, findPlaylist, playlistArtists, type BuildResult } from "./playlists.ts";
import { createPredictedSongQueue, findPredictedSongs, isValid, type PredictedSongs } from "./predicted-songs.ts";
import { createSessions, type User } from "./sessions.ts";
import { createSetlistFm } from "./setlist-fm.ts";
import type { Settings } from "./settings.ts";
import { createSpotifyArtistQueue, findSpotifyArtist, setSpotifyArtistByHand, type StoredSpotifyArtist } from "./spotify-artists.ts";
import { completeSpotifyLogIn, startSpotifyLogIn } from "./spotify-log-in.ts";
import { createSpotify, createSpotifyPlaylists, readSpotifyArtistId } from "./spotify.ts";

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
  "/festival-page.js": { type: "text/javascript; charset=utf-8", body: readFileSync(join(publicDirectory, "festival-page.js")) },
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
  const spotify = createSpotify(httpClient, database, clock, settings);
  const setlistFm = createSetlistFm(httpClient);
  const predictedSongs = createPredictedSongQueue({ database, setlistFm, musicBrainz, spotify, clock, settings: settings.prediction });
  // After a find of the Spotify artist, the predicted songs are calculated, except
  // when they are valid. A different Spotify artist needs a new calculation.
  const spotifyArtists = createSpotifyArtistQueue(database, musicBrainz, spotify, clock, (musicbrainzId, changed) =>
    predictedSongs.calculate([musicbrainzId], { again: changed }),
  );
  const playlists = createPlaylistBuilder({
    database,
    spotify: createSpotifyPlaylists(httpClient, database, clock, settings),
    clock,
    settings: settings.playlist,
  });
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

  // The festival list shows the result: published, or the cause (FN-02).
  app.post("/admin/festivals/:id/publish", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    publishFestival(database, festival.id);
    return context.redirect(`/admin/festivals?publish=${festival.id}`, 303);
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
    // The same rule for the Spotify artists of the matches.
    const spotifyQueue = spotifyArtists.state();
    if (!spotifyQueue.running && spotifyQueue.problem === undefined) {
      const missing = matchedArtists(names).filter((artist) => findSpotifyArtist(database, artist.id) === undefined);
      if (missing.length > 0) spotifyArtists.find(missing);
    }
    // The same rule for the predicted songs. A result that is no longer valid is calculated again.
    const predictionQueue = predictedSongs.state();
    if (!predictionQueue.running && predictionQueue.problem === undefined) {
      const missing = artistsWithoutPredictedSongs(names);
      if (missing.length > 0) predictedSongs.calculate(missing);
    }
    const saved = lineupNameFromQuery(festival.id, context.req.query("saved"));
    const spotifySaved = lineupNameFromQuery(festival.id, context.req.query("spotify"));
    return context.html(
      artistMatchesPage(context.var.user!, {
        festival,
        names,
        queue: artistSearches.state(),
        spotifyArtists: storedSpotifyArtists(matchedArtists(names)),
        spotifyQueue: spotifyArtists.state(),
        predictedSongs: storedPredictedSongs(matchedArtists(names)),
        predictionQueue: predictedSongs.state(),
        predictionSettings: settings.prediction,
        ...(saved ? { saved } : {}),
        ...(spotifySaved ? { spotifySaved } : {}),
      }),
    );
  });

  app.post("/admin/festivals/:id/artist-matches/search", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    artistSearches.searchFestival(festival.id);
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches`, 303);
  });

  app.post("/admin/festivals/:id/artist-matches/spotify", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const names = festivalArtistMatches(database, festival.id);
    spotifyArtists.find(matchedArtists(names).filter((artist) => findSpotifyArtist(database, artist.id) === undefined));
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches`, 303);
  });

  app.post("/admin/festivals/:id/artist-matches/predicted-songs", (context) => {
    const festival = findFestivalForAdmin(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    predictedSongs.calculate(artistsWithoutPredictedSongs(festivalArtistMatches(database, festival.id)));
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches`, 303);
  });

  app.get("/admin/festivals/:id/artist-matches/:lineupNameId/predicted-songs", (context) => {
    const found = matchedLineupName(context.req.param("id"), context.req.param("lineupNameId"));
    if (found === undefined) return context.html(notFoundPage(context.var.user!), 404);
    return context.html(
      predictedSongsPage(context.var.user!, {
        ...found,
        spotify: findSpotifyArtist(database, found.artist.id),
        songs: findPredictedSongs(database, found.artist.id),
        waiting: predictedSongs.isWaiting(found.artist.id),
        queue: predictedSongs.state(),
        settings: settings.prediction,
      }),
    );
  });

  // Calculates the predicted songs again in the background (user story 70). The
  // page shows that the calculation waits, and then the new result (FN-02).
  app.post("/admin/festivals/:id/artist-matches/:lineupNameId/predicted-songs", (context) => {
    const found = matchedLineupName(context.req.param("id"), context.req.param("lineupNameId"));
    if (found === undefined) return context.html(notFoundPage(context.var.user!), 404);
    predictedSongs.calculate([found.artist.id], { again: true });
    return context.redirect(`/admin/festivals/${found.festival.id}/artist-matches/${found.name.lineupNameId}/predicted-songs`, 303);
  });

  app.get("/admin/festivals/:id/artist-matches/:lineupNameId/spotify", (context) => {
    const found = matchedLineupName(context.req.param("id"), context.req.param("lineupNameId"));
    if (found === undefined) return context.html(notFoundPage(context.var.user!), 404);
    return context.html(spotifyArtistPage(context.var.user!, { ...found, spotify: findSpotifyArtist(database, found.artist.id) }));
  });

  app.post("/admin/festivals/:id/artist-matches/:lineupNameId/spotify", async (context) => {
    const found = matchedLineupName(context.req.param("id"), context.req.param("lineupNameId"));
    if (found === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const form = await context.req.parseBody();
    const address = typeof form.address === "string" ? form.address.trim() : "";
    const showProblem = (problem: string) =>
      context.html(
        spotifyArtistPage(context.var.user!, { ...found, spotify: findSpotifyArtist(database, found.artist.id), address, problem }),
        400,
      );
    const id = readSpotifyArtistId(address);
    if (id === undefined) {
      return showProblem(
        address === ""
          ? "Enter the address of the Spotify artist."
          : "Enter the address of a Spotify artist, for example https://open.spotify.com/artist/1Ffb6ejR6Fe5IamqA5oRUF.",
      );
    }
    const result = await spotify.artist(id);
    if (result.outcome === "not-found") return showProblem("Spotify has no artist at this address. Make sure that you copied the full address.");
    if (result.outcome === "failed") return showProblem(`The application could not get the artist from Spotify. ${result.cause}`);
    setSpotifyArtistByHand(database, clock, found.artist.id, result.artist);
    // The predicted songs of the old Spotify artist are not correct.
    predictedSongs.calculate([found.artist.id], { again: true });
    return context.redirect(`/admin/festivals/${found.festival.id}/artist-matches?spotify=${found.name.lineupNameId}`, 303);
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
    // A new save finds the Spotify artist again, because the MusicBrainz data can be different.
    if (choice.kind === "artist") spotifyArtists.find([choice.artist], { again: true });
    return context.redirect(`/admin/festivals/${festival.id}/artist-matches?saved=${name.lineupNameId}`, 303);
  });

  app.get("/", (context) =>
    context.html(
      festivalsPage(
        context.var.user!,
        listPublishedFestivals(database, londonDate(clock.now())),
        festivalsWithPlaylist(database, context.var.user!.id),
      ),
    ),
  );

  // A festival that is not published does not exist for users (user story 9).
  app.get("/festivals/:id", (context) => {
    const festival = findPublishedFestival(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const user = context.var.user!;
    const playlist = findPlaylist(database, user.id, festival.id);
    // The confirmation after "Make the playlist" or "Update the playlist". The redirect
    // comes only after Spotify accepted each request (FN-02).
    const done = context.req.query("playlist");
    const playlistResult: BuildResult | undefined =
      playlist?.complete && (done === "made" || done === "updated") ? { outcome: "done", made: done === "made" } : undefined;
    return context.html(
      festivalPage(user, {
        festival,
        artists: playlistArtists(database, festival.id, user.id),
        settings: settings.playlist,
        ...(playlist ? { playlist } : {}),
        ...(playlistResult ? { playlistResult } : {}),
        saved: context.req.query("saved") !== undefined,
      }),
    );
  });

  // Makes the playlist, or sets the songs of the playlist that the user has (#15).
  // After a success, the browser goes to the Festival page, so that a refresh does
  // not send the request again. A failure shows the Festival page with the cause.
  app.post("/festivals/:id/playlist", async (context) => {
    const festival = findPublishedFestival(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const user = context.var.user!;
    const result = await playlists.build(festival, user.id);
    if (result.outcome === "done") {
      return context.redirect(`/festivals/${festival.id}?playlist=${result.made ? "made" : "updated"}`, 303);
    }
    const playlist = findPlaylist(database, user.id, festival.id);
    const status = result.outcome === "failed" ? 502 : result.outcome === "busy" ? 409 : 400;
    return context.html(
      festivalPage(user, {
        festival,
        artists: playlistArtists(database, festival.id, user.id),
        settings: settings.playlist,
        ...(playlist ? { playlist } : {}),
        playlistResult: result,
      }),
      status,
    );
  });

  // Saves interest levels. Each field "level-{lineup name ID}" has one level.
  // The script on the Festival page sends one field for each change, and asks
  // for JSON. A browser without JavaScript sends the full form, and gets the
  // Festival page again.
  app.post("/festivals/:id/interest-levels", async (context) => {
    const festival = findPublishedFestival(database, Number(context.req.param("id")));
    if (festival === undefined) return context.html(notFoundPage(context.var.user!), 404);
    const levels = new Map<number, InterestLevel>();
    for (const [field, value] of Object.entries(await context.req.parseBody())) {
      const id = /^level-(\d+)$/.exec(field)?.[1];
      if (id === undefined) continue;
      if (!isInterestLevel(value)) return context.text(`The interest level of ${field} is not valid.`, 400);
      levels.set(Number(id), value);
    }
    const result = saveInterestLevels(database, festival.id, context.var.user!.id, levels);
    if (result.outcome === "not-on-lineup") {
      return context.text(`Lineup name ${result.lineupNameId} is not an artist on the lineup of this festival.`, 400);
    }
    if (context.req.header("accept")?.includes("application/json")) return context.json({ saved: levels.size });
    return context.redirect(`/festivals/${festival.id}?saved`, 303);
  });

  app.notFound((context) => context.html(notFoundPage(context.var.user!), 404));

  return app;

  function lineupNameFromQuery(festivalId: number, value: string | undefined) {
    const id = Number(value);
    return value !== undefined && Number.isSafeInteger(id) ? festivalLineupName(database, festivalId, id) : undefined;
  }

  // A lineup name on the current lineup of a festival, with a match to a MusicBrainz artist.
  function matchedLineupName(festivalId: string, lineupNameId: string) {
    const festival = findFestivalForAdmin(database, Number(festivalId));
    const name = festival && festivalLineupName(database, festival.id, Number(lineupNameId));
    if (festival === undefined || name === undefined || name.match?.kind !== "artist") return undefined;
    return { festival, name, artist: name.match.artist };
  }

  function storedSpotifyArtists(artists: MusicBrainzArtist[]): Map<string, StoredSpotifyArtist> {
    const result = new Map<string, StoredSpotifyArtist>();
    for (const artist of artists) {
      const stored = findSpotifyArtist(database, artist.id);
      if (stored !== undefined) result.set(artist.id, stored);
    }
    return result;
  }

  function storedPredictedSongs(artists: MusicBrainzArtist[]): Map<string, PredictedSongs> {
    const result = new Map<string, PredictedSongs>();
    for (const artist of artists) {
      const stored = findPredictedSongs(database, artist.id);
      if (stored !== undefined) result.set(artist.id, stored);
    }
    return result;
  }

  // The MusicBrainz IDs of the matched artists that have a Spotify artist and no valid predicted songs.
  function artistsWithoutPredictedSongs(names: { match?: ArtistMatch }[]): string[] {
    return matchedArtists(names)
      .filter((artist) => findSpotifyArtist(database, artist.id)?.kind === "found")
      .filter((artist) => {
        const stored = findPredictedSongs(database, artist.id);
        return stored === undefined || !isValid(stored, clock.now(), settings.prediction);
      })
      .map((artist) => artist.id);
  }

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

// The MusicBrainz artist of each match, one time for each artist.
function matchedArtists(names: { match?: ArtistMatch }[]): MusicBrainzArtist[] {
  const artists = new Map<string, MusicBrainzArtist>();
  for (const { match } of names) if (match?.kind === "artist") artists.set(match.artist.id, match.artist);
  return [...artists.values()];
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
    query.added !== undefined
      ? (["added", query.added] as const)
      : query.lineup !== undefined
        ? (["got-lineup", query.lineup] as const)
        : query.publish !== undefined
          ? (["publish", query.publish] as const)
          : [];
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
