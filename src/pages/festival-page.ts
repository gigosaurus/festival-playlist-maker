import { html } from "hono/html";
import type { PublishedFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { count, formatDateRange } from "./format.ts";
import { layout } from "./layout.ts";

// The Festival page of a published festival. #10 adds the interest levels.
// artists: the lineup names that have an artist match, in alphabetical order.
// Names marked "no match" are not artists, so they do not show.
export function festivalPage(user: User, festival: PublishedFestival, artists: string[]) {
  const title = `${festival.name} ${festival.year}`;
  return layout({
    title,
    description: `The lineup of ${title}, for a Spotify playlist.`,
    user,
    body: html`
      <p class="back-link"><a href="/">Festivals</a></p>
      <h1><span data-external-text>${title}</span></h1>
      <p class="festival-dates festival-page-dates">${formatDateRange(festival.startDate, festival.endDate)}</p>
      <section class="lineup" aria-labelledby="lineup-heading">
        <h2 id="lineup-heading">Lineup</h2>
        <p class="lineup-count">${count(artists.length, "artist", "artists")}</p>
        <ul class="lineup-list">
          ${artists.map((artist) => html`<li data-external-text>${artist}</li>`)}
        </ul>
      </section>
    `,
  });
}
