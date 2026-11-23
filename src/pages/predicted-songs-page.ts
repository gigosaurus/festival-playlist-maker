import { html } from "hono/html";
import type { LineupNameMatch } from "../artist-matches.ts";
import type { AdminFestival } from "../festivals.ts";
import { musicbrainzArtistAddress, type MusicBrainzArtist } from "../musicbrainz.ts";
import { hasLongLookBack, validUntil, type PredictedSongs, type PredictionQueueState } from "../predicted-songs.ts";
import type { User } from "../sessions.ts";
import type { PredictionSettings } from "../settings.ts";
import type { StoredSpotifyArtist } from "../spotify-artists.ts";
import { spotifyTrackEmbedAddress } from "../spotify.ts";
import { spotifyLine } from "./artist-matches-page.ts";
import { formatDate, formatDateAndTime } from "./format.ts";
import { layout } from "./layout.ts";

export interface PredictedSongsPageState {
  festival: AdminFestival;
  name: LineupNameMatch;
  artist: MusicBrainzArtist;
  spotify: StoredSpotifyArtist | undefined;
  songs: PredictedSongs | undefined;
  // True when the artist waits for a calculation.
  waiting: boolean;
  queue: PredictionQueueState;
  settings: PredictionSettings;
}

// Check the predicted songs of one artist, and calculate them again (user stories 66 to 68 and 70).
export function predictedSongsPage(user: User, state: PredictedSongsPageState) {
  const { festival, name, artist, spotify, songs } = state;
  const title = `${festival.name} ${festival.year}`;
  const address = `/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}/predicted-songs`;
  return layout({
    title: `Predicted songs for ${name.name}`,
    description: "Check the predicted songs of one artist.",
    user,
    body: html`
      <p class="back-link">
        <a href="/admin/festivals/${festival.id}/artist-matches">Artist matches for <span data-external-text>${title}</span></a>
      </p>
      <h1>Predicted songs for <span data-external-text>${name.name}</span></h1>
      <dl class="facts">
        <div>
          <dt>MusicBrainz artist</dt>
          <dd>
            <a href="${musicbrainzArtistAddress(artist.id)}" target="_blank" rel="noopener"><span data-external-text>${artist.name}</span><span
              class="visually-hidden"> on MusicBrainz</span></a>
          </dd>
        </div>
        <div>
          <dt>Spotify artist</dt>
          <dd>${spotifyLine(spotify, false)}</dd>
        </div>
        ${songs === undefined
          ? ""
          : html`
              <div>
                <dt>Calculated</dt>
                <dd>${formatDateAndTime(songs.calculatedAt)}. Valid until ${formatDate(validUntil(songs, state.settings).toISOString().slice(0, 10))}.</dd>
              </div>
              <div>
                <dt>Source</dt>
                <dd>${source(songs, state.settings)}</dd>
              </div>
            `}
      </dl>
      ${calculationState(state, address)}
      ${songs === undefined ? "" : songList(songs)}
    `,
  });
}

// The source of the songs, with the fallback mark or the long look-back mark (user stories 67 and 68).
function source(songs: PredictedSongs, settings: PredictionSettings) {
  if (songs.fallback) {
    return html`<span class="genre-warning">Warning: no setlists on setlist.fm in the last ${songs.lookBackMonths} months.
      The songs come from a Spotify search for the artist, so they are not predicted.</span>`;
  }
  if (hasLongLookBack(songs, settings)) {
    return html`${setlists(songs)} from the last ${songs.lookBackMonths} months.
      <span class="genre-warning">Warning: fewer than ${settings.fewShows} shows in the last ${settings.lookBackMonths} months,
        so the prediction is less reliable.</span>`;
  }
  return html`${setlists(songs)} from the last ${songs.lookBackMonths} months`;
}

// "Setlists on setlist.fm", with a link to the setlist.fm page of the artist when the
// result has it (#18). The link is the attribution that the setlist.fm terms require.
function setlists(songs: PredictedSongs) {
  return songs.setlistFmAddress === undefined
    ? "Setlists on setlist.fm"
    : html`<a href="${songs.setlistFmAddress}" target="_blank" rel="noopener">Setlists on setlist.fm</a>`;
}

function calculationState(state: PredictedSongsPageState, address: string) {
  const { spotify, songs, waiting, queue } = state;
  if (spotify?.kind !== "found") {
    return html`
      <section class="empty-state" aria-labelledby="no-songs-heading">
        <h2 id="no-songs-heading">The artist has no predicted songs</h2>
        <p>The application finds the songs of the Spotify artist.
          ${spotify === undefined ? "The search for the Spotify artist is not complete." : "Set the Spotify artist first."}</p>
      </section>
    `;
  }
  if (waiting && queue.running) {
    return html`
      <p class="search-progress">
        ${songs === undefined ? "The calculation of the predicted songs waits or runs." : "A new calculation waits or runs."}
        ${queue.waitingUntil === undefined
          ? ""
          : html`A service limited the requests, so the calculation continues at ${formatDateAndTime(queue.waitingUntil)}.`}
        <a href="${address}">Show the new result</a>
      </p>
    `;
  }
  return html`
    ${queue.problem === undefined
      ? ""
      : html`
          <section class="notice" aria-labelledby="calculation-problem-heading">
            <h2 id="calculation-problem-heading">The calculation of the predicted songs stopped on ${formatDateAndTime(queue.problem.at)}</h2>
            <p class="problem-cause" data-external-text>${queue.problem.cause}</p>
          </section>
        `}
    <form method="post" action="${address}" class="calculate-form">
      <button class="button-secondary" type="submit">Calculate the predicted songs again</button>
    </form>
  `;
}

// The Spotify embed player of each song, in order of score (LY-06). The list has
// role="list", because Safari removes the list role when the style removes the markers.
function songList(songs: PredictedSongs) {
  if (songs.trackIds.length === 0) {
    return html`<p class="genre-warning">Warning: Spotify has none of the songs. Playlists get no songs for this artist.</p>`;
  }
  return html`
    <section aria-labelledby="songs-heading">
      <h2 id="songs-heading">Songs in order of prediction (${songs.trackIds.length})</h2>
      <ol class="predicted-song-list" role="list">
        ${songs.trackIds.map(
          (id, index) => html`<li>
            <iframe class="spotify-player" src="${spotifyTrackEmbedAddress(id)}" title="Song ${index + 1} in the Spotify player" height="80"
              loading="lazy" allow="encrypted-media"></iframe>
          </li>`,
        )}
      </ol>
    </section>
  `;
}
