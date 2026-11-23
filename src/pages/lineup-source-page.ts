import { html } from "hono/html";
import { clashfinderPageAddress } from "../clashfinder.ts";
import type { AdminFestival } from "../festivals.ts";
import type { User } from "../sessions.ts";
import { clashfinderChoices, hasChoices, type ClashfinderSearch } from "./clashfinder-choices.ts";
import { layout } from "./layout.ts";

export interface LineupSourcePageState {
  festival: AdminFestival;
  // The text in the search field. Before the first search, it is the festival name.
  searchText: string;
  // The ID of the chosen Clashfinder page.
  chosen: string;
  search?: ClashfinderSearch;
  // The problem of the field "page" after "Change the lineup source".
  problem?: string;
}

// The admin changes the Clashfinder page that gives the lineup (user story 50).
// Version 1 has one lineup source, so the admin chooses a different page.
export function lineupSourcePage(user: User, { festival, searchText, chosen, search, problem }: LineupSourcePageState) {
  const title = `${festival.name} ${festival.year}`;
  const source = festival.lineupSource;
  const hasResults = hasChoices(search);
  const address = `/admin/festivals/${festival.id}/lineup-source`;
  return layout({
    title: `${problem ? "Error: " : ""}Change the lineup source of ${title}`,
    description: "Choose a different Clashfinder page for the lineup of a festival.",
    user,
    body: html`
      <p class="back-link"><a href="/admin/festivals">Manage festivals</a></p>
      <h1>Change the lineup source of <span data-external-text>${title}</span></h1>
      ${problem ? errorSummary(problem) : ""}
      <dl class="facts">
        <div>
          <dt>Lineup source now</dt>
          <dd>
            Clashfinder:
            <a href="${clashfinderPageAddress(source.page)}" data-external-text>${source.pageName}</a>
          </dd>
        </div>
      </dl>
      <form class="festival-form" method="post" action="${address}" novalidate>
        <section class="lineup-source" aria-labelledby="lineup-source-heading">
          <h2 id="lineup-source-heading">New lineup source: Clashfinder</h2>
          <div class="field">
            <label class="label" for="search">Name or address of the Clashfinder page</label>
            <p class="hint" id="search-hint">
              The search also shows pages with a different name that start on the festival dates.
            </p>
            <div class="search-row">
              <input class="input" id="search" name="search" type="search" value="${searchText}" aria-describedby="search-hint" autocomplete="off">
              <button class="${hasResults ? "button-secondary" : "button"}" type="submit" formmethod="get" formaction="${address}" formnovalidate>
                Search Clashfinder
              </button>
            </div>
          </div>
          ${search ? clashfinderChoices(search, chosen, problem) : ""}
        </section>
        ${hasResults ? html`<button class="button" type="submit">Change the lineup source</button>` : ""}
      </form>
    `,
  });
}

function errorSummary(problem: string) {
  return html`
    <section class="notice error-summary" aria-labelledby="error-summary-heading" tabindex="-1" data-error-summary>
      <h2 id="error-summary-heading">Correct the problem to change the lineup source</h2>
      <ul>
        <li><a href="#page-choices">${problem}</a></li>
      </ul>
    </section>
    <script>document.querySelector("[data-error-summary]").focus();</script>
  `;
}
