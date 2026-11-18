import { html } from "hono/html";
import { checkGenres, type ArtistMatch, type Proposal } from "../artist-matches.ts";
import { musicbrainzArtistAddress, type MusicBrainzArtist } from "../musicbrainz.ts";
import { formatCountry } from "./format.ts";

// The genres that a choice shows. The genre check uses all genres.
const shownGenres = 5;

export interface ArtistChoicesOptions {
  festivalId: number;
  lineupNameId: number;
  lineupName: string;
  // The text of the search that gave the artists.
  searchText: string;
  artists: MusicBrainzArtist[];
  expectedGenres: string[];
  proposal: Proposal;
  current?: ArtistMatch;
  // The problem after a save without a choice.
  problem?: string;
  // The element that names the choices, for example the heading of the lineup name.
  labelledBy: string;
  // True: when an artist is chosen, the other artists are in a closed "details"
  // element, so that a list of many lineup names stays short.
  collapse?: boolean;
}

// The form that saves the artist match of one lineup name: one radio button for
// each possible artist and one for "No match". The current match is chosen.
// Without a current match, the proposal is chosen, so that one action saves it.
export function artistChoices(options: ArtistChoicesOptions) {
  const { festivalId, lineupNameId, lineupName, searchText, expectedGenres, proposal, current, problem, labelledBy } = options;
  const artists = [...options.artists];
  // The current artist is a choice also when the search did not find it.
  if (current?.kind === "artist" && !artists.some((artist) => artist.id === current.artist.id)) artists.unshift(current.artist);
  const chosen = current
    ? current.kind === "artist"
      ? current.artist.id
      : "no-match"
    : proposal?.kind === "artist"
      ? proposal.id
      : proposal?.kind === "no-match"
        ? "no-match"
        : undefined;
  const proposed = proposal?.kind === "artist" ? proposal.id : proposal?.kind;
  const prefix = `choice-${lineupNameId}`;
  return html`
    <form class="match-form" method="post" action="/admin/festivals/${festivalId}/artist-matches">
      <input type="hidden" name="lineupName" value="${lineupNameId}">
      <input type="hidden" name="search" value="${searchText}" data-external-text>
      <fieldset class="field-group match-choices${problem ? " field-with-problem" : ""}" aria-labelledby="${labelledBy}"
        ${problem ? html`aria-describedby="${prefix}-problem"` : ""}>
        ${problem ? html`<p class="field-problem" id="${prefix}-problem">${problem}</p>` : ""}
        ${choiceLists()}
      </fieldset>
      <button class="button" type="submit">
        Save the match<span class="visually-hidden"> for <span data-external-text>${lineupName}</span></span>
      </button>
    </form>
  `;

  function choiceLists() {
    const item = (artist: MusicBrainzArtist) =>
      html`<li>${artistChoice(prefix, artist, expectedGenres, artist.id === chosen, marker(artist.id))}</li>`;
    const noMatch = html`<li>${noMatchChoice(prefix, chosen === "no-match", marker("no-match"))}</li>`;
    const first = artists.find((artist) => artist.id === chosen);
    const others = artists.filter((artist) => artist !== first);
    if (!options.collapse || chosen === undefined || others.length === 0) {
      return html`<ul class="choices">${artists.map(item)} ${noMatch}</ul>`;
    }
    return html`
      <ul class="choices">${first ? item(first) : ""} ${noMatch}</ul>
      <details class="more-choices">
        <summary>${others.length === 1 ? (first ? "Show 1 other artist" : "Show 1 artist") : `Show ${others.length} ${first ? "other artists" : "artists"}`}</summary>
        <ul class="choices">${others.map(item)}</ul>
      </details>
    `;
  }

  function marker(value: string): string | undefined {
    if (current !== undefined) return value === chosen ? "Current match" : undefined;
    return value === proposed ? "Proposed" : undefined;
  }
}

function artistChoice(prefix: string, artist: MusicBrainzArtist, expectedGenres: string[], checked: boolean, marker: string | undefined) {
  const id = `${prefix}-${artist.id}`;
  const facts = artistFacts(artist);
  const warning = genreWarning(artist, expectedGenres);
  const hasGenres = artist.genres.length > 0;
  const describedBy = [facts.length > 0 ? `${id}-facts` : "", hasGenres ? `${id}-genres` : "", warning ? `${id}-warning` : ""]
    .filter(Boolean)
    .join(" ");
  return html`
    <div class="choice">
      <input class="choice-input" type="radio" name="choice" id="${id}" value="${artist.id}" ${checked ? "checked" : ""}
        aria-describedby="${describedBy}">
      <div class="choice-body">
        <label class="choice-label" for="${id}"><span data-external-text>${artist.name}</span>${marker
          ? html` <span class="badge">${marker}</span>`
          : ""}</label>
        ${facts.length > 0
          ? html`<p class="choice-facts" id="${id}-facts">${facts.map(
              (fact, index) => html`${index > 0 ? " · " : ""}<span class="fact" data-external-text>${fact}</span>`,
            )}</p>`
          : ""}
        ${hasGenres
          ? html`<p class="choice-facts" id="${id}-genres">Genres: <span data-external-text>${artist.genres
              .slice(0, shownGenres)
              .join(", ")}</span></p>`
          : ""}
        ${warning ? html`<p class="genre-warning" id="${id}-warning">${warning}</p>` : ""}
        <p class="choice-link">
          <a href="${musicbrainzArtistAddress(artist.id)}" target="_blank" rel="noopener">Open
            <span data-external-text>${artist.name}</span> on MusicBrainz</a>
        </p>
      </div>
    </div>
  `;
}

function noMatchChoice(prefix: string, checked: boolean, marker: string | undefined) {
  const id = `${prefix}-no-match`;
  return html`
    <div class="choice">
      <input class="choice-input" type="radio" name="choice" id="${id}" value="no-match" ${checked ? "checked" : ""}
        aria-describedby="${id}-facts">
      <div class="choice-body">
        <label class="choice-label" for="${id}">No match${marker ? html` <span class="badge">${marker}</span>` : ""}</label>
        <p class="choice-facts" id="${id}-facts">The name is not one artist. Playlists get no songs for it.</p>
      </div>
    </div>
  `;
}

// The text that identifies an artist: the disambiguation, the type, the country
// and the active years. A person has a birth year, not active years.
export function artistFacts(artist: MusicBrainzArtist): string[] {
  const begin = artist.begin?.slice(0, 4);
  const end = artist.end?.slice(0, 4);
  let years: string | undefined;
  if (artist.type === "Person") {
    if (begin && end) years = `${begin}–${end}`;
    else if (begin) years = `Born ${begin}`;
  } else if (begin && end) years = `Active ${begin}–${end}`;
  else if (begin) years = artist.ended ? `Active from ${begin}, ended` : `Active from ${begin}`;
  else if (end) years = `Ended ${end}`;
  return [
    artist.disambiguation,
    artist.type,
    artist.country ? formatCountry(artist.country) : artist.area,
    years,
  ].filter((fact): fact is string => fact !== undefined);
}

// The warning for an artist with none of the expected genres. It does not stop
// the match (user story 59).
export function genreWarning(artist: MusicBrainzArtist, expectedGenres: string[]): string | undefined {
  const check = checkGenres(artist, expectedGenres);
  if (check.outcome === "no-expected-genre") return "Warning: none of the expected genres";
  if (check.outcome === "no-genres") return "Warning: no genres on MusicBrainz";
  return undefined;
}
