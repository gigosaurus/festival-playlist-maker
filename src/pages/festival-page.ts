import { html } from "hono/html";
import type { PublishedFestival } from "../festivals.ts";
import { interestLevelNames, interestLevels, playlistArtistCount, type LineupArtist } from "../interest-levels.ts";
import type { User } from "../sessions.ts";
import { count, formatDateRange } from "./format.ts";
import { layout } from "./layout.ts";

export interface FestivalPageState {
  festival: PublishedFestival;
  // The artists on the lineup, in alphabetical order, with the interest levels of the user.
  artists: LineupArtist[];
  // True after "Save the interest levels" in a browser without JavaScript.
  saved?: boolean;
}

// The Festival page: the user sets the interest level of each artist.
//
// The script /festival-page.js saves each change immediately, so one action
// sets a level. It also shows the search, the filter and the sort, which run
// in the browser. Without the script, the radio buttons are one form with the
// button "Save the interest levels".
export function festivalPage(user: User, { festival, artists, saved }: FestivalPageState) {
  const title = `${festival.name} ${festival.year}`;
  return layout({
    title,
    description: `Set your interest levels for the artists on the lineup of ${title}.`,
    user,
    scripts: ["/festival-page.js"],
    body: html`
      <p class="back-link"><a href="/">Festivals</a></p>
      <h1><span data-external-text>${title}</span></h1>
      <p class="festival-dates festival-page-dates">${formatDateRange(festival.startDate, festival.endDate)}</p>
      ${saved
        ? html`<div class="notice notice-success" role="status"><h2>Saved the interest levels</h2></div>`
        : ""}
      <p class="playlist-count" role="status" data-playlist-count>${playlistCount(playlistArtistCount(artists), artists.length)}</p>
      <section class="lineup" aria-labelledby="lineup-heading">
        <h2 id="lineup-heading">Lineup</h2>
        ${lineupTools()}
        <p class="lineup-count" role="status" data-lineup-count tabindex="-1">${count(artists.length, "artist", "artists")}</p>
        <p class="lineup-action" data-show-all hidden><button class="button-secondary" type="button">Show all artists</button></p>
        <p class="lineup-action" data-update-list hidden>
          Your last changes do not move or hide artists until you update the list.
          <button class="button-secondary" type="button">Update the list</button>
        </p>
        <form method="post" action="/festivals/${festival.id}/interest-levels" data-interest-levels>
          <ul class="lineup-list">
            ${artists.map(artistRow)}
          </ul>
          <p class="lineup-save" data-save-all><button class="button" type="submit">Save the interest levels</button></p>
        </form>
      </section>
    `,
  });
}

// The script shows the tools. They do not operate without it.
function lineupTools() {
  return html`
    <form class="lineup-tools" role="search" aria-label="Lineup" data-lineup-tools hidden>
      <div class="lineup-tool lineup-tool-search">
        <label class="label" for="lineup-search">Search by artist name</label>
        <input class="input" id="lineup-search" name="search" type="search" autocomplete="off" spellcheck="false">
      </div>
      <div class="lineup-tool">
        <label class="label" for="lineup-level">Interest level</label>
        <select class="input" id="lineup-level" name="level">
          <option value="">All interest levels</option>
          ${[...interestLevels].reverse().map((level) => html`<option value="${level}">${interestLevelNames[level]}</option>`)}
        </select>
      </div>
      <div class="lineup-tool">
        <label class="label" for="lineup-sort">Sort by</label>
        <select class="input" id="lineup-sort" name="sort">
          <option value="">Name</option>
          <option value="level">Interest level, Must see first</option>
        </select>
      </div>
    </form>
  `;
}

function artistRow(artist: LineupArtist, index: number) {
  const id = artist.lineupNameId;
  return html`
    <li class="artist" data-artist="${id}" data-index="${index}" data-level="${artist.level}">
      <div class="artist-text">
        <p class="artist-name" id="artist-${id}" data-external-text>${artist.name}</p>
        ${artist.genres.length > 0
          ? html`<p class="artist-genres" id="artist-${id}-genres" data-external-text>${artist.genres.slice(0, 3).join(", ")}</p>`
          : ""}
      </div>
      <div
        class="levels"
        role="radiogroup"
        aria-labelledby="artist-${id}"
        ${artist.genres.length > 0 ? html`aria-describedby="artist-${id}-genres"` : ""}
      >
        ${interestLevels.map(
          (level) => html`
            <label class="level">
              <input class="level-input" type="radio" name="level-${id}" value="${level}" ${level === artist.level ? "checked" : ""}>
              <span>${interestLevelNames[level]}</span>
            </label>
          `,
        )}
      </div>
      <p class="field-problem artist-problem" role="alert" data-problem hidden></p>
    </li>
  `;
}

// "The playlist will contain 142 of 150 artists."
export function playlistCount(playlist: number, total: number): string {
  return `The playlist will contain ${playlist} of ${count(total, "artist", "artists")}.`;
}
