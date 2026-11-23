import { html } from "hono/html";
import { proposeArtist, type LineupNameMatch, type SearchQueueState } from "../artist-matches.ts";
import type { QueueState } from "../background-queue.ts";
import type { AdminFestival } from "../festivals.ts";
import { hasLongLookBack, longestLookBack, type PredictedSongs, type PredictionQueueState } from "../predicted-songs.ts";
import type { User } from "../sessions.ts";
import type { PredictionSettings } from "../settings.ts";
import type { StoredSpotifyArtist } from "../spotify-artists.ts";
import { spotifyArtistAddress } from "../spotify.ts";
import { artistChoices, artistFacts, genreWarning } from "./artist-choices.ts";
import { count, formatDateAndTime } from "./format.ts";
import { layout } from "./layout.ts";

export interface ArtistMatchesPageState {
  festival: AdminFestival;
  names: LineupNameMatch[];
  queue: SearchQueueState;
  // The lineup name of the last save, with its match from the database.
  saved?: LineupNameMatch;
  // The Spotify artist of each matched MusicBrainz artist, by MusicBrainz ID.
  spotifyArtists: Map<string, StoredSpotifyArtist>;
  spotifyQueue: QueueState;
  // The lineup name of the last save of a Spotify artist.
  spotifySaved?: LineupNameMatch;
  // The predicted songs of each matched MusicBrainz artist, by MusicBrainz ID.
  predictedSongs: Map<string, PredictedSongs>;
  predictionQueue: PredictionQueueState;
  predictionSettings: PredictionSettings;
  // The lineup name IDs that the last lineup change added (user story 48).
  newNames: ReadonlySet<number>;
}

export function artistMatchesPage(user: User, state: ArtistMatchesPageState) {
  const { festival, names, queue, saved, spotifyArtists, spotifySaved } = state;
  const title = `${festival.name} ${festival.year}`;
  const unmatched = names.filter((name) => name.match === undefined);
  const matched = names.filter((name) => name.match !== undefined);
  return layout({
    title: `Artist matches for ${title}`,
    description: "Match each lineup name of a festival to a MusicBrainz artist.",
    user,
    body: html`
      <p class="back-link"><a href="/admin/festivals">Manage festivals</a></p>
      <h1>Artist matches for <span data-external-text>${title}</span></h1>
      ${saved?.match ? savedNotice(saved, festival) : ""}
      ${spotifySaved?.match?.kind === "artist" ? spotifySavedNotice(spotifySaved, spotifyArtists.get(spotifySaved.match.artist.id)) : ""}
      <dl class="facts">
        <div>
          <dt>Expected genres</dt>
          <dd data-external-text>${festival.expectedGenres.join(", ")}</dd>
        </div>
      </dl>
      ${festival.lineupUpdatedAt === undefined
        ? html`
            <section class="empty-state" aria-labelledby="no-lineup-heading">
              <h2 id="no-lineup-heading">The festival has no lineup</h2>
              <p>Get the lineup on Manage festivals. Then match the artists.</p>
            </section>
          `
        : html`${unmatchedSection(festival, unmatched, queue, state.newNames)} ${matchedSection(state, matched)}`}
    `,
  });
}

function savedNotice(saved: LineupNameMatch, festival: AdminFestival) {
  const match = saved.match!;
  if (match.kind === "no-match") {
    return html`
      <section class="notice notice-success" aria-labelledby="saved-heading">
        <h2 id="saved-heading">Marked <span data-external-text>${saved.name}</span> “no match”</h2>
      </section>
    `;
  }
  const warning = genreWarning(match.artist, festival.expectedGenres);
  const heading = html`Matched <span data-external-text>${saved.name}</span> to <span data-external-text>${match.artist.name}</span>`;
  if (warning === undefined) {
    return html`
      <section class="notice notice-success" aria-labelledby="saved-heading">
        <h2 id="saved-heading">${heading}</h2>
      </section>
    `;
  }
  // The match is saved. The warning tells the admin to check it (user stories 58 and 59).
  return html`
    <section class="notice notice-warning" aria-labelledby="saved-heading">
      <h2 id="saved-heading">${heading}</h2>
      <p>${warning}. Make sure that it is the correct artist.</p>
    </section>
  `;
}

function spotifySavedNotice(saved: LineupNameMatch, spotify: StoredSpotifyArtist | undefined) {
  if (spotify?.kind !== "found" || saved.match?.kind !== "artist") return "";
  return html`
    <section class="notice notice-success" aria-labelledby="spotify-saved-heading">
      <h2 id="spotify-saved-heading">Set the Spotify artist of <span data-external-text>${saved.match.artist.name}</span> to <span
        data-external-text>${spotify.artist.name}</span></h2>
    </section>
  `;
}

function unmatchedSection(festival: AdminFestival, unmatched: LineupNameMatch[], queue: SearchQueueState, newNames: ReadonlySet<number>) {
  if (unmatched.length === 0) {
    return html`
      <section class="empty-state match-section" aria-labelledby="unmatched-heading">
        <h2 id="unmatched-heading">Each lineup name has an artist match</h2>
      </section>
    `;
  }
  const waiting = unmatched.filter((name) => name.search === undefined).length;
  return html`
    <section class="match-section" aria-labelledby="unmatched-heading">
      <h2 id="unmatched-heading">Names without an artist match (${unmatched.length})</h2>
      ${waiting > 0 ? searchState(festival, waiting, queue) : ""}
      <ul class="match-list">
        ${unmatched.map((name) => html`<li>${unmatchedName(festival, name, newNames.has(name.lineupNameId))}</li>`)}
      </ul>
    </section>
  `;
}

// The searches run in the background at 1 request each second. The page does
// not change by itself, so the admin loads it again to see more results.
function searchState(festival: AdminFestival, waiting: number, queue: SearchQueueState) {
  if (queue.problem !== undefined) {
    return html`
      <section class="notice" aria-labelledby="search-problem-heading">
        <h3 id="search-problem-heading">The MusicBrainz search stopped on ${formatDateAndTime(queue.problem.at)}</h3>
        <p class="problem-cause" data-external-text>${queue.problem.cause}</p>
        <form method="post" action="/admin/festivals/${festival.id}/artist-matches/search">
          <button class="button-secondary" type="submit">Search again</button>
        </form>
      </section>
    `;
  }
  return html`
    <p class="search-progress">
      ${waiting === 1 ? "1 name waits" : `${waiting} names wait`} for the MusicBrainz search. The search does 1 name each second.
      <a href="/admin/festivals/${festival.id}/artist-matches">Show the new results</a>
    </p>
  `;
}

// The badge "New" shows that the last lineup check added the name.
const newBadge = html` <span class="badge">New</span>`;

function unmatchedName(festival: AdminFestival, name: LineupNameMatch, isNew: boolean) {
  const headingId = `name-${name.lineupNameId}`;
  return html`
    <article class="match-item" aria-labelledby="${headingId}">
      <h3 id="${headingId}" class="match-item-heading"><span data-external-text>${name.name}</span>${isNew ? newBadge : ""}</h3>
      ${name.search === undefined
        ? html`<p class="hint">Waiting for the MusicBrainz search.</p>`
        : html`
            ${name.search.artists.length === 0 ? html`<p class="hint">MusicBrainz found no artist.</p>` : ""}
            ${artistChoices({
              festivalId: festival.id,
              lineupNameId: name.lineupNameId,
              lineupName: name.name,
              searchText: name.search.text,
              artists: name.search.artists,
              expectedGenres: festival.expectedGenres,
              proposal: proposeArtist(name.name, name.search.artists, festival.expectedGenres),
              labelledBy: headingId,
              collapse: true,
            })}
          `}
      <p class="match-item-link">
        <a href="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}">Search with a different text<span
          class="visually-hidden"> for <span data-external-text>${name.name}</span></span></a>
      </p>
    </article>
  `;
}

function matchedSection(state: ArtistMatchesPageState, matched: LineupNameMatch[]) {
  const { festival, spotifyArtists, spotifyQueue, predictedSongs, predictionQueue } = state;
  if (matched.length === 0) return "";
  const warningOf = (name: LineupNameMatch) =>
    name.match?.kind === "artist" ? genreWarning(name.match.artist, festival.expectedGenres) : undefined;
  // The matches with a genre warning are first, because they are probably wrong (user story 58).
  const sorted = [...matched].sort((a, b) => Number(warningOf(b) !== undefined) - Number(warningOf(a) !== undefined));
  const warnings = sorted.filter((name) => warningOf(name) !== undefined).length;
  const waiting = new Set(
    matched.flatMap((name) => (name.match?.kind === "artist" && !spotifyArtists.has(name.match.artist.id) ? name.match.artist.id : [])),
  ).size;
  // The artists with a Spotify artist and no predicted songs.
  const artistIds = new Set(matched.flatMap((name) => (name.match?.kind === "artist" ? name.match.artist.id : [])));
  const withoutSongs = [...artistIds].filter((id) => spotifyArtists.get(id)?.kind === "found" && !predictedSongs.has(id)).length;
  const fallbacks = [...artistIds].filter((id) => predictedSongs.get(id)?.fallback).length;
  // The artists with the long look-back mark (#14, user story 67).
  const settings = state.predictionSettings;
  const longLookBacks = [...artistIds].filter((id) => {
    const songs = predictedSongs.get(id);
    return songs !== undefined && hasLongLookBack(songs, settings);
  }).length;
  return html`
    <section class="match-section" aria-labelledby="matched-heading">
      <h2 id="matched-heading">Artist matches (${matched.length})</h2>
      ${warnings > 0
        ? html`<p class="hint">${warnings === 1 ? "1 match has" : `${warnings} matches have`} a genre warning. ${warnings === 1
            ? "It is"
            : "They are"} first in the list.</p>`
        : ""}
      ${waiting > 0 ? spotifyState(festival, waiting, spotifyQueue) : ""}
      ${withoutSongs > 0 ? predictionState(festival, withoutSongs, predictionQueue) : ""}
      ${longLookBacks > 0
        ? html`<p class="hint">${count(longLookBacks, "artist has", "artists have")} fewer than ${settings.fewShows} shows in the last ${settings.lookBackMonths} months
            and ${longLookBacks === 1 ? "uses" : "use"} older setlists.</p>`
        : ""}
      ${fallbacks > 0
        ? html`<p class="hint">${count(fallbacks, "artist has", "artists have")} no setlists in the last ${longestLookBack(settings)} months and ${fallbacks === 1
            ? "uses"
            : "use"} the Spotify search fallback.</p>`
        : ""}
      <ul class="matched-list">
        ${sorted.map((name) => html`<li>${matchedName(state, name, warningOf(name))}</li>`)}
      </ul>
    </section>
  `;
}

// Each find of a Spotify artist sends 2 or 3 requests, so it takes 1 to 3 seconds.
function spotifyState(festival: AdminFestival, waiting: number, queue: QueueState) {
  if (queue.problem !== undefined) {
    return html`
      <section class="notice" aria-labelledby="spotify-problem-heading">
        <h3 id="spotify-problem-heading">The search for Spotify artists stopped on ${formatDateAndTime(queue.problem.at)}</h3>
        <p class="problem-cause" data-external-text>${queue.problem.cause}</p>
        <form method="post" action="/admin/festivals/${festival.id}/artist-matches/spotify">
          <button class="button-secondary" type="submit">Find the Spotify artists again</button>
        </form>
      </section>
    `;
  }
  return html`
    <p class="search-progress">
      ${waiting === 1 ? "1 artist waits" : `${waiting} artists wait`} for the Spotify artist. The application finds 1 artist in approximately 2 seconds.
      <a href="/admin/festivals/${festival.id}/artist-matches">Show the new results</a>
    </p>
  `;
}

// One calculation sends 1 or more setlist.fm requests and up to 20 Spotify requests.
// The first calculation of an artist with many shows also sends 1 setlist.fm
// request for each venue and date (#13), so it can take approximately 1 minute.
function predictionState(festival: AdminFestival, waiting: number, queue: PredictionQueueState) {
  if (queue.problem !== undefined) {
    return html`
      <section class="notice" aria-labelledby="prediction-problem-heading">
        <h3 id="prediction-problem-heading">The calculation of the predicted songs stopped on ${formatDateAndTime(queue.problem.at)}</h3>
        <p class="problem-cause" data-external-text>${queue.problem.cause}</p>
        <form method="post" action="/admin/festivals/${festival.id}/artist-matches/predicted-songs">
          <button class="button-secondary" type="submit">Calculate the predicted songs again</button>
        </form>
      </section>
    `;
  }
  return html`
    <p class="search-progress">
      ${waiting === 1 ? "1 artist waits" : `${waiting} artists wait`} for the predicted songs. The application calculates 1 artist in approximately 10 seconds to 1 minute.
      ${queue.waitingUntil === undefined
        ? ""
        : html`A service limited the requests, so the calculation continues at ${formatDateAndTime(queue.waitingUntil)}.`}
      <a href="/admin/festivals/${festival.id}/artist-matches">Show the new results</a>
    </p>
  `;
}

const sourceText = { musicbrainz: "from the MusicBrainz link", search: "from a Spotify search", admin: "set by hand" } as const;

function matchedName(state: ArtistMatchesPageState, name: LineupNameMatch, warning: string | undefined) {
  const { festival, spotifyArtists, predictedSongs } = state;
  const match = name.match!;
  const spotify = match.kind === "artist" ? spotifyArtists.get(match.artist.id) : undefined;
  const songs = match.kind === "artist" ? predictedSongs.get(match.artist.id) : undefined;
  return html`
    <div class="matched-name">
      <p class="matched-lineup-name" id="name-${name.lineupNameId}"><span data-external-text>${name.name}</span>${state.newNames.has(
        name.lineupNameId,
      )
        ? newBadge
        : ""}</p>
      ${match.kind === "artist"
        ? html`<p class="matched-artist">
            <span data-external-text>${match.artist.name}</span>${artistFacts(match.artist).map(
              (fact) => html` · <span class="fact" data-external-text>${fact}</span>`,
            )}
          </p>`
        : html`<p class="matched-artist">No match</p>`}
      ${warning ? html`<p class="genre-warning">${warning}</p>` : ""}
      ${match.kind === "artist" ? spotifyLine(spotify) : ""}
      ${spotify?.kind === "found" ? songsLine(songs, state.predictionSettings) : ""}
    </div>
    <p class="matched-actions">
      <a href="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}">Change<span
        class="visually-hidden"> the match for <span data-external-text>${name.name}</span></span></a>
      ${match.kind === "artist"
        ? html`<a href="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}/spotify">Set the Spotify artist<span
              class="visually-hidden"> for <span data-external-text>${name.name}</span></span></a>
            <a href="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}/predicted-songs">Show the predicted songs<span
              class="visually-hidden"> for <span data-external-text>${name.name}</span></span></a>`
        : ""}
    </p>
  `;
}

// The predicted songs of a match (user stories 66 to 68).
function songsLine(songs: PredictedSongs | undefined, settings: PredictionSettings) {
  if (songs === undefined) return html`<p class="matched-spotify">Predicted songs: waiting</p>`;
  if (songs.trackIds.length === 0) {
    return html`<p class="genre-warning">Warning: no predicted songs on Spotify. Playlists get no songs for this artist.</p>`;
  }
  if (songs.fallback) {
    return html`<p class="genre-warning">Warning: no setlists in the last ${songs.lookBackMonths} months. ${count(songs.trackIds.length, "song", "songs")} from a Spotify search.</p>`;
  }
  if (hasLongLookBack(songs, settings)) {
    return html`<p class="genre-warning">Warning: fewer than ${settings.fewShows} shows in the last ${settings.lookBackMonths} months. ${count(
      songs.trackIds.length,
      "song",
      "songs",
    )} from setlists of the last ${songs.lookBackMonths} months.</p>`;
  }
  return html`<p class="matched-spotify">Predicted songs: ${count(songs.trackIds.length, "song", "songs")} from setlists</p>`;
}

// The Spotify artist of a match (user story 63). The link opens it in Spotify, in a new tab.
// `label` is false in a list of facts, where the term gives the label. Then the
// text is inline, in the style of the other facts.
export function spotifyLine(spotify: StoredSpotifyArtist | undefined, label = true) {
  if (spotify?.kind === "not-found") {
    return html`<p class="genre-warning">Warning: no Spotify artist found. Playlists get no songs for this artist.</p>`;
  }
  const content =
    spotify === undefined
      ? label
        ? "Spotify artist: waiting"
        : "Waiting for the search"
      : html`${label ? "Spotify artist: " : ""}<a href="${spotifyArtistAddress(spotify.artist.id)}" target="_blank" rel="noopener"><span
            data-external-text>${spotify.artist.name}</span><span class="visually-hidden"> in Spotify</span></a>
          · ${sourceText[spotify.source]}`;
  return label ? html`<p class="matched-spotify">${content}</p>` : content;
}
