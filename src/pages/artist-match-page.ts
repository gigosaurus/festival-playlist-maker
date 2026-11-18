import { html } from "hono/html";
import { proposeArtist, type LineupNameMatch, type StoredSearch } from "../artist-matches.ts";
import type { AdminFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { artistChoices } from "./artist-choices.ts";
import { layout } from "./layout.ts";

export interface ArtistMatchPageState {
  festival: AdminFestival;
  name: LineupNameMatch;
  // The text in the search field.
  searchText: string;
  search: { outcome: "found"; search: StoredSearch } | { outcome: "failed"; cause: string };
  // The problem after a save without a choice.
  problem?: string;
}

// Search MusicBrainz with a different text for one lineup name, and make or change its artist match.
export function artistMatchPage(user: User, { festival, name, searchText, search, problem }: ArtistMatchPageState) {
  const title = `${festival.name} ${festival.year}`;
  return layout({
    title: problem ? `Error: Artist match for ${name.name}` : `Artist match for ${name.name}`,
    description: "Search MusicBrainz and choose the artist for one lineup name.",
    user,
    body: html`
      <p class="back-link">
        <a href="/admin/festivals/${festival.id}/artist-matches">Artist matches for <span data-external-text>${title}</span></a>
      </p>
      <h1>Artist match for <span data-external-text>${name.name}</span></h1>
      <form class="match-search" method="get" action="/admin/festivals/${festival.id}/artist-matches/${name.lineupNameId}">
        <div class="field">
          <label class="label" for="search">Name or address of the MusicBrainz artist</label>
          <div class="search-row">
            <input class="input" id="search" name="search" type="search" value="${searchText}" autocomplete="off"
              data-external-text>
            <button class="button-secondary" type="submit">Search MusicBrainz</button>
          </div>
        </div>
      </form>
      ${search.outcome === "failed"
        ? html`
            <section class="notice" aria-labelledby="search-problem-heading">
              <h2 id="search-problem-heading">The search did not complete</h2>
              <p class="problem-cause" data-external-text>${search.cause}</p>
            </section>
          `
        : html`
            <section aria-labelledby="results-heading">
              <h2 id="results-heading">Artists that match “<span data-external-text>${search.search.text}</span>”</h2>
              ${search.search.artists.length === 0 ? html`<p class="hint">MusicBrainz found no artist.</p>` : ""}
              ${artistChoices({
                festivalId: festival.id,
                lineupNameId: name.lineupNameId,
                lineupName: name.name,
                searchText: search.search.text,
                artists: search.search.artists,
                expectedGenres: festival.expectedGenres,
                // The proposal compares the artists with the lineup name, not with the search text.
                proposal: proposeArtist(name.name, search.search.artists, festival.expectedGenres),
                ...(name.match ? { current: name.match } : {}),
                ...(problem ? { problem } : {}),
                labelledBy: "results-heading",
              })}
            </section>
          `}
    `,
  });
}
