import { html } from "hono/html";
import type { PublishedFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { formatDateRange } from "./format.ts";
import { layout } from "./layout.ts";

// withPlaylist: the IDs of the festivals for which the user has a playlist (user story 8).
export function festivalsPage(
  user: User,
  festivals: { toCome: PublishedFestival[]; complete: PublishedFestival[] },
  withPlaylist: Set<number>,
) {
  const { toCome, complete } = festivals;
  return layout({
    title: "Festivals",
    description: "Choose a festival and make a Spotify playlist from its lineup.",
    user,
    body: html`
      <h1>Festivals</h1>
      ${toCome.length === 0 && complete.length === 0 ? emptyState() : ""}
      ${toCome.length > 0 ? festivalList(toCome, withPlaylist) : ""}
      ${complete.length > 0
        ? html`
            <section class="complete-festivals" aria-labelledby="complete-festivals-heading">
              <h2 id="complete-festivals-heading">Complete festivals</h2>
              ${festivalList(complete, withPlaylist)}
            </section>
          `
        : ""}
    `,
  });
}

function emptyState() {
  return html`
    <section class="empty-state" aria-labelledby="empty-state-heading">
      <h2 id="empty-state-heading">There are no published festivals</h2>
      <p>A festival shows here when the admin publishes it.</p>
    </section>
  `;
}

// Each festival is one link that opens its Festival page. The dates are in the
// link, so that the full panel opens the page.
function festivalList(festivals: PublishedFestival[], withPlaylist: Set<number>) {
  return html`
    <ul class="festival-list">
      ${festivals.map(
        (festival) => html`
          <li>
            <a class="festival-link" href="/festivals/${festival.id}">
              <span class="festival-title">
                <span class="festival-name" data-external-text>${festival.name} ${festival.year}</span>
                ${withPlaylist.has(festival.id) ? html`<span class="badge">Your playlist is made</span>` : ""}
              </span>
              <span class="festival-dates">${formatDateRange(festival.startDate, festival.endDate)}</span>
            </a>
          </li>
        `,
      )}
    </ul>
  `;
}
