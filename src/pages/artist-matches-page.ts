import { html } from "hono/html";
import { proposeArtist, type LineupNameMatch, type SearchQueueState } from "../artist-matches.ts";
import type { AdminFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { artistChoices, artistFacts, genreWarning } from "./artist-choices.ts";
import { formatDateAndTime } from "./format.ts";
import { layout } from "./layout.ts";

export interface ArtistMatchesPageState {
  festival: AdminFestival;
  names: LineupNameMatch[];
  queue: SearchQueueState;
  // The lineup name of the last save, with its match from the database.
  saved?: LineupNameMatch;
}

export function artistMatchesPage(user: User, { festival, names, queue, saved }: ArtistMatchesPageState) {
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
        : html`${unmatchedSection(festival, unmatched, queue)} ${matchedSection(festival, matched)}`}
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

function unmatchedSection(festival: AdminFestival, unmatched: LineupNameMatch[], queue: SearchQueueState) {
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
        ${unmatched.map((name) => html`<li>${unmatchedName(festival, name)}</li>`)}
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

function unmatchedName(festival: AdminFestival, name: LineupNameMatch) {
  const headingId = `name-${name.lineupNameId}`;
  return html`
    <article class="match-item" aria-labelledby="${headingId}">
      <h3 id="${headingId}" class="match-item-heading"><span data-external-text>${name.name}</span></h3>
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

function matchedSection(festival: AdminFestival, matched: LineupNameMatch[]) {
  if (matched.length === 0) return "";
  const warningOf = (name: LineupNameMatch) =>
    name.match?.kind === "artist" ? genreWarning(name.match.artist, festival.expectedGenres) : undefined;
  // The matches with a genre warning are first, because they are probably wrong (user story 58).
  const sorted = [...matched].sort((a, b) => Number(warningOf(b) !== undefined) - Number(warningOf(a) !== undefined));
  const warnings = sorted.filter((name) => warningOf(name) !== undefined).length;
  return html`
    <section class="match-section" aria-labelledby="matched-heading">
      <h2 id="matched-heading">Artist matches (${matched.length})</h2>
      ${warnings > 0
        ? html`<p class="hint">${warnings === 1 ? "1 match has" : `${warnings} matches have`} a genre warning. ${warnings === 1
            ? "It is"
            : "They are"} first in the list.</p>`
        : ""}
      <ul class="matched-list">
        ${sorted.map((name) => html`<li>${matchedName(festival, name, warningOf(name))}</li>`)}
      </ul>
    </section>
  `;
}

function matchedName(festival: AdminFestival, name: LineupNameMatch, warning: string | undefined) {
  const match = name.match!;
  return html`
    <div class="matched-name">
      <p class="matched-lineup-name"><span data-external-text>${name.name}</span></p>
      ${match.kind === "artist"
        ? html`<p class="matched-artist">
            <span data-external-text>${match.artist.name}</span>${artistFacts(match.artist).map(
              (fact) => html` · <span class="fact" data-external-text>${fact}</span>`,
            )}
          </p>`
        : html`<p class="matched-artist">No match</p>`}
      ${warning ? html`<p class="genre-warning">${warning}</p>` : ""}
    </div>
    <a class="matched-change" href="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}">Change<span
      class="visually-hidden"> the match for <span data-external-text>${name.name}</span></span></a>
  `;
}
