import { html } from "hono/html";
import type { LineupNameMatch } from "../artist-matches.ts";
import type { AdminFestival } from "../festivals.ts";
import { musicbrainzArtistAddress, type MusicBrainzArtist } from "../musicbrainz.ts";
import type { User } from "../sessions.ts";
import type { StoredSpotifyArtist } from "../spotify-artists.ts";
import { artistFacts } from "./artist-choices.ts";
import { spotifyLine } from "./artist-matches-page.ts";
import { layout } from "./layout.ts";

export interface SpotifyArtistPageState {
  festival: AdminFestival;
  name: LineupNameMatch;
  artist: MusicBrainzArtist;
  spotify: StoredSpotifyArtist | undefined;
  // The text in the address field after a save with a problem.
  address?: string;
  problem?: string;
}

// Set the Spotify artist of a matched MusicBrainz artist by hand (user story 64).
export function spotifyArtistPage(user: User, { festival, name, artist, spotify, address, problem }: SpotifyArtistPageState) {
  const title = `${festival.name} ${festival.year}`;
  return layout({
    title: problem ? `Error: Spotify artist for ${name.name}` : `Spotify artist for ${name.name}`,
    description: "Set the Spotify artist for one artist match.",
    user,
    body: html`
      <p class="back-link">
        <a href="/admin/festivals/${festival.id}/artist-matches">Artist matches for <span data-external-text>${title}</span></a>
      </p>
      <h1>Spotify artist for <span data-external-text>${name.name}</span></h1>
      <dl class="facts">
        <div>
          <dt>MusicBrainz artist</dt>
          <dd>
            <a href="${musicbrainzArtistAddress(artist.id)}" target="_blank" rel="noopener"><span data-external-text>${artist.name}</span><span
              class="visually-hidden"> on MusicBrainz</span></a>${artistFacts(artist).map(
              (fact) => html` · <span class="fact" data-external-text>${fact}</span>`,
            )}
          </dd>
        </div>
        <div>
          <dt>Current Spotify artist</dt>
          <dd>${spotifyLine(spotify, false)}</dd>
        </div>
      </dl>
      <form class="match-search" method="post" action="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}/spotify">
        <div class="field${problem ? " field-with-problem" : ""}">
          <label class="label" for="address">Address of the Spotify artist</label>
          <p class="hint" id="address-hint">In Spotify, open the artist. Then select Share and “Copy link to artist”.</p>
          ${problem ? html`<p class="field-problem" id="address-problem">${problem}</p>` : ""}
          <input class="input" id="address" name="address" type="text" value="${address ?? ""}" autocomplete="off" spellcheck="false"
            aria-describedby="${problem ? "address-problem address-hint" : "address-hint"}" ${problem ? "aria-invalid=true" : ""}
            data-external-text>
        </div>
        <button class="button" type="submit">Save the Spotify artist</button>
      </form>
    `,
  });
}
