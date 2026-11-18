import { html } from "hono/html";
import type { PublishedFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { layout } from "./layout.ts";

const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function festivalsPage(user: User, festivals: PublishedFestival[]) {
  return layout({
    title: "Festivals",
    description: "Choose a festival and make a Spotify playlist from its lineup.",
    user,
    body: html`
      <h1>Festivals</h1>
      ${festivals.length === 0 ? emptyState() : festivalList(festivals)}
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

// The list design is part of the "Publish a festival" ticket (#9).
function festivalList(festivals: PublishedFestival[]) {
  return html`
    <ul class="festival-list">
      ${festivals.map(
        (festival) => html`
          <li>
            <span class="festival-name">${festival.name} ${festival.year}</span>
            <span class="festival-dates">${dateRange(festival)}</span>
          </li>
        `,
      )}
    </ul>
  `;
}

function dateRange(festival: PublishedFestival): string {
  return dayMonthYear.formatRange(new Date(festival.startDate), new Date(festival.endDate));
}
