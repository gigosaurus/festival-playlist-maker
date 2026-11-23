import { html } from "hono/html";
import type { PublishedFestival } from "../festivals.ts";
import { interestLevelNames, interestLevels } from "../interest-levels.ts";
import { playlistName, songCount, type BuildResult, type NamedChanges, type PlaylistArtist, type StoredPlaylist } from "../playlists.ts";
import type { User } from "../sessions.ts";
import type { PlaylistSettings } from "../settings.ts";
import { spotifyArtistAddress } from "../spotify.ts";
import { count, formatDateAndTime, formatDateRange } from "./format.ts";
import { layout } from "./layout.ts";

export interface FestivalPageState {
  festival: PublishedFestival;
  // The artists on the lineup, in alphabetical order, with the interest levels of the user.
  artists: PlaylistArtist[];
  // The lineup name IDs of the artists that were not on the lineup at the last complete update.
  newArtists: Set<number>;
  settings: PlaylistSettings;
  // The playlist of the user for this festival, when Spotify made it.
  playlist?: StoredPlaylist;
  // True after "Save the interest levels" in a browser without JavaScript.
  saved?: boolean;
  // The result of the last "Make the playlist" or "Update the playlist".
  playlistResult?: BuildResult;
  // The added and removed artists, after "Update the playlist" only.
  changes?: NamedChanges;
}

// The Festival page: the user sets the interest level of each artist, and makes the playlist.
//
// The script /festival-page.js saves each change immediately, so one action
// sets a level. It also shows the search, the filter and the sort, which run
// in the browser. Without the script, the radio buttons are one form with the
// button "Save the interest levels".
export function festivalPage(user: User, { festival, artists, newArtists, settings, playlist, saved, playlistResult, changes }: FestivalPageState) {
  const title = playlistName(festival);
  return layout({
    title,
    description: `Set your interest levels for the artists on the lineup of ${title}, and make your Spotify playlist.`,
    user,
    scripts: ["/festival-page.js"],
    body: html`
      <p class="back-link"><a href="/">Festivals</a></p>
      <h1><span data-external-text>${title}</span></h1>
      <p class="festival-dates festival-page-dates">${formatDateRange(festival.startDate, festival.endDate)}</p>
      ${saved
        ? html`<div class="notice notice-success" role="status"><h2>Saved the interest levels</h2></div>`
        : ""}
      ${playlistResult ? playlistNotice(playlistResult, title, changes) : ""}
      ${playlistSection(festival, artists, newArtists.size, settings, playlist, playlistResult?.outcome === "failed" && playlistResult.stage === "incomplete")}
      <section class="lineup" aria-labelledby="lineup-heading">
        <h2 id="lineup-heading">Lineup</h2>
        ${lineupTools(newArtists.size > 0)}
        <p class="lineup-count" role="status" data-lineup-count tabindex="-1">${count(artists.length, "artist", "artists")}</p>
        <p class="lineup-action" data-show-all hidden><button class="button-secondary" type="button">Show all artists</button></p>
        <p class="lineup-action" data-update-list hidden>
          Your last changes do not move or hide artists until you update the list.
          <button class="button-secondary" type="button">Update the list</button>
        </p>
        <form method="post" action="/festivals/${festival.id}/interest-levels" data-interest-levels>
          <ul class="lineup-list">
            ${artists.map((artist, index) => artistRow(artist, index, newArtists.has(artist.lineupNameId)))}
          </ul>
          <p class="lineup-save" data-save-all><button class="button" type="submit">Save the interest levels</button></p>
        </form>
      </section>
    `,
  });
}

// The number of songs, the link to the playlist, the last update and the action.
// The script changes the number of songs after each saved interest level. It
// therefore gets the song count of each level in data-song-counts.
// `incompleteNotice`: the notice above already says that the playlist does not have all of the songs.
// `newCount`: the number of artists that were not on the lineup at the last complete update.
function playlistSection(
  festival: PublishedFestival,
  artists: PlaylistArtist[],
  newCount: number,
  settings: PlaylistSettings,
  playlist: StoredPlaylist | undefined,
  incompleteNotice: boolean,
) {
  const playlistArtists = artists.filter((artist) => artistSongs(artist, settings) > 0);
  const songs = playlistArtists.reduce((sum, artist) => sum + artistSongs(artist, settings), 0);
  return html`
    <section class="playlist" aria-labelledby="playlist-heading">
      <h2 id="playlist-heading">Playlist</h2>
      ${playlist
        ? html`
            <p class="playlist-link"><a href="${playlist.address}">Open <span data-external-text>${playlistName(festival)}</span> in Spotify</a></p>
            ${playlist.updatedAt ? html`<p class="playlist-updated">Last update: ${formatDateAndTime(playlist.updatedAt)}</p>` : ""}
            ${newCount > 0
              ? html`<p class="playlist-new">${newCount === 1 ? "1 artist is" : `${newCount} artists are`} new on the lineup since your last update.</p>`
              : ""}
            ${playlist.complete || incompleteNotice
              ? ""
              : html`<p class="genre-warning">Warning: the playlist in Spotify does not have all of the songs. Update the playlist.</p>`}
          `
        : ""}
      <p class="playlist-count" role="status" data-playlist-count data-song-counts="${JSON.stringify(settings.songCounts)}">
        ${playlistCount(songs, playlistArtists.length, artists.length)}
      </p>
      <form class="playlist-form" method="post" action="/festivals/${festival.id}/playlist" data-playlist-form>
        <button class="button" type="submit">${playlist ? "Update the playlist" : "Make the playlist"}</button>
      </form>
    </section>
  `;
}

function artistSongs(artist: PlaylistArtist, settings: PlaylistSettings): number {
  return Math.min(songCount(artist.level, settings), artist.predictedSongs);
}

// The notice after "Make the playlist" or "Update the playlist". A success notice
// shows only after Spotify accepted each request (FN-02).
// After an update, the notice gives the added and removed artists (user story 30).
function playlistNotice(result: BuildResult, title: string, changes: NamedChanges | undefined) {
  if (result.outcome === "done") {
    return html`
      <section class="notice notice-success" role="status" aria-labelledby="playlist-notice-heading">
        <h2 id="playlist-notice-heading">${result.made ? "Made" : "Updated"} the playlist <span data-external-text>${title}</span> in Spotify</h2>
        ${changes ? changeLists(changes) : ""}
      </section>
    `;
  }
  const [heading, text] =
    result.outcome === "empty"
      ? ["The playlist would contain no songs", "Set Curious, Keen or Must see for one or more artists that have predicted songs."]
      : result.outcome === "busy"
        ? ["The application is already making this playlist", "Wait a short time, then reload the page."]
        : [
            result.stage === "not-made"
              ? "The application did not make the playlist"
              : result.stage === "not-changed"
                ? "The playlist did not change"
                : "The playlist in Spotify does not have all of the songs",
            result.cause,
          ];
  return html`
    <section class="notice" role="alert" aria-labelledby="playlist-notice-heading">
      <h2 id="playlist-notice-heading">${heading}</h2>
      <p>${text}</p>
    </section>
  `;
}

function changeLists({ added, removed }: NamedChanges) {
  if (added.length === 0 && removed.length === 0) return html`<p>No artist was added or removed.</p>`;
  return html`
    ${added.length > 0
      ? html`
          <h3 class="change-heading">Added ${count(added.length, "artist", "artists")}</h3>
          <ul class="${changeListClass(added.length)}">
            ${added.map((name) => html`<li><span data-external-text>${name}</span></li>`)}
          </ul>
        `
      : ""}
    ${removed.length > 0
      ? html`
          <h3 class="change-heading">Removed ${count(removed.length, "artist", "artists")}</h3>
          <ul class="${changeListClass(removed.length)}">
            ${removed.map(
              ({ name, onLineup }) =>
                html`<li><span data-external-text>${name}</span>${onLineup ? "" : html` <span class="change-reason">(not on the lineup)</span>`}</li>`,
            )}
          </ul>
        `
      : ""}
  `;
}

function changeListClass(length: number): string {
  return length > 6 ? "change-list change-list-long" : "change-list";
}

// The script shows the tools. They do not operate without it.
// `hasNew`: one or more artists are new since the last complete update.
function lineupTools(hasNew: boolean) {
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
      ${hasNew
        ? html`
            <div class="lineup-tool lineup-tool-check">
              <label class="check"><input type="checkbox" name="new" value="1"> Only new artists</label>
            </div>
          `
        : ""}
    </form>
  `;
}

// `isNew`: the artist was not on the lineup at the last complete update (user story 21).
function artistRow(artist: PlaylistArtist, index: number, isNew: boolean) {
  const id = artist.lineupNameId;
  const describedBy = [...(isNew ? [`artist-${id}-new`] : []), ...(artist.genres.length > 0 ? [`artist-${id}-genres`] : [])];
  return html`
    <li class="artist" data-artist="${id}" data-index="${index}" data-level="${artist.level}" data-songs="${artist.predictedSongs}" ${isNew ? html`data-new` : ""}>
      <div class="artist-text">
        <p class="artist-heading">
          <span class="artist-name" id="artist-${id}" data-external-text>${artist.name}</span>
          ${isNew ? html`<span class="badge" id="artist-${id}-new">New</span>` : ""}
        </p>
        ${artist.genres.length > 0
          ? html`<p class="artist-genres" id="artist-${id}-genres" data-external-text>${artist.genres.slice(0, 3).join(", ")}</p>`
          : ""}
        ${artist.predictedSongs === 0 ? html`<p class="artist-genres">No predicted songs</p>` : ""}
        ${artist.predictedSongs > 0 && artist.fallback
          ? html`<p class="artist-genres" id="artist-${id}-fallback">The songs come from a Spotify search, not from setlists.</p>`
          : ""}
        ${listenLine(artist)}
      </div>
      <div
        class="levels"
        role="radiogroup"
        aria-labelledby="artist-${id}"
        ${describedBy.length > 0 ? html`aria-describedby="${describedBy.join(" ")}"` : ""}
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

// The player button, the Spotify artist and the setlist.fm setlists of one artist (#18).
// The links show only the name of the destination, so that the line fits next to the
// interest levels. The visually hidden artist name makes each link specific.
// The script shows the button and opens the Spotify embed player under the line.
// It gets the songs from data-tracks. The setlist.fm link is also the attribution
// that the setlist.fm terms require, so it is not nofollow.
function listenLine(artist: PlaylistArtist) {
  const hasSongs = artist.trackIds.length > 0;
  if (!hasSongs && artist.spotifyArtistId === undefined && artist.setlistFmAddress === undefined) return "";
  const name = html`<span class="visually-hidden"> for <span data-external-text>${artist.name}</span></span>`;
  const on = html`<span class="visually-hidden"><span data-external-text>${artist.name}</span> on </span>`;
  return html`
    <div class="listen" ${hasSongs ? html`data-tracks="${artist.trackIds.join(" ")}"` : ""}>
      <p class="listen-links">
        ${hasSongs
          ? html`<button class="listen-button" type="button" aria-expanded="false" data-play hidden>
              <span data-play-label>Play the songs</span>${name}
            </button>`
          : ""}
        ${artist.spotifyArtistId === undefined
          ? ""
          : html`<a href="${spotifyArtistAddress(artist.spotifyArtistId)}">${on}Spotify</a>`}
        ${artist.setlistFmAddress === undefined ? "" : html`<a href="${artist.setlistFmAddress}">${on}setlist.fm</a>`}
      </p>
    </div>
  `;
}

// "The playlist will contain 284 songs by 142 of 150 artists."
export function playlistCount(songs: number, artists: number, total: number): string {
  return `The playlist will contain ${count(songs, "song", "songs")} by ${artists} of ${count(total, "artist", "artists")}.`;
}
