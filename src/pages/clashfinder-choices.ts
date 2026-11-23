import { html } from "hono/html";
import { clashfinderPageAddress, maximumResults, type ClashfinderPage, type SearchResult } from "../clashfinder.ts";
import { count, formatDate } from "./format.ts";

// The search text that the search used, and its result.
export interface ClashfinderSearch {
  text: string;
  result: SearchResult;
  // True when the search also looked for pages on the festival dates.
  hasDates: boolean;
}

// True when the search found 1 or more pages to choose.
export function hasChoices(search: ClashfinderSearch | undefined): boolean {
  return search?.result.outcome === "found" && search.result.nameMatches.length + search.result.dateMatches.length > 0;
}

// The results of a Clashfinder search, as radio buttons with the name "page".
// The Add a festival page and the Change the lineup source page use them.
// problem: the problem text of the field "page", for example when no page is chosen.
export function clashfinderChoices(search: ClashfinderSearch, chosen: string, problem: string | undefined) {
  const { result, text, hasDates } = search;
  if (result.outcome === "failed") {
    return html`
      <section class="notice" aria-labelledby="search-problem-heading" id="page-choices" tabindex="-1">
        <h3 id="search-problem-heading">The search did not complete</h3>
        <p data-external-text>${result.cause}</p>
      </section>
    `;
  }
  const { nameMatches, dateMatches, dateMatchCount } = result;
  if (nameMatches.length === 0 && dateMatches.length === 0) {
    return html`
      <div class="empty-state search-empty" id="page-choices" tabindex="-1">
        <h3>No Clashfinder page matches “<span data-external-text>${text}</span>”</h3>
        <p>${hasDates ? "No other page starts on the festival dates." : "Enter the festival dates to also see the pages that start on those dates."}</p>
      </div>
    `;
  }
  return html`
    <fieldset class="field-group page-choices${problem ? " field-with-problem" : ""}" id="page-choices" tabindex="-1"
      ${problem ? html`aria-describedby="page-problem"` : ""}>
      <legend>Clashfinder page</legend>
      ${problem ? html`<p class="field-problem" id="page-problem">${problem}</p>` : ""}
      ${hasDates ? "" : html`<p class="hint">Enter the festival dates to also see the pages that start on those dates.</p>`}
      ${choiceGroup(
        html`Pages that match “<span data-external-text>${text}</span>”`,
        nameMatches,
        chosen,
        nameMatches.length === maximumResults ? `The first ${maximumResults} pages. Enter more words to see fewer pages.` : undefined,
      )}
      ${hasDates && dateMatches.length > 0
        ? choiceGroup(
            "Other pages that start on the festival dates",
            dateMatches,
            chosen,
            dateMatchCount > dateMatches.length
              ? `The ${dateMatches.length} pages with the most acts, of ${dateMatchCount}.`
              : undefined,
          )
        : ""}
    </fieldset>
  `;
}

function choiceGroup(heading: string | ReturnType<typeof html>, pages: ClashfinderPage[], chosen: string, note: string | undefined) {
  if (pages.length === 0) return "";
  return html`
    <h3 class="choice-group-heading">${heading}</h3>
    ${note ? html`<p class="hint">${note}</p>` : ""}
    <ul class="choices">
      ${pages.map((page) => html`<li>${choice(page, chosen)}</li>`)}
    </ul>
  `;
}

function choice(page: ClashfinderPage, chosen: string) {
  const id = `page-${page.id}`;
  const facts = [
    page.startDate ? `Starts ${formatDate(page.startDate)}` : "No start date",
    page.days ? count(page.days, "day", "days") : undefined,
    page.stages ? count(page.stages, "stage", "stages") : undefined,
    count(page.acts ?? 0, "act", "acts"),
    page.lastEdit ? `Last change ${formatDate(page.lastEdit)}` : undefined,
  ].filter(Boolean);
  return html`
    <div class="choice">
      <input class="choice-input" type="radio" name="page" id="${id}" value="${page.id}" ${page.id === chosen ? "checked" : ""}
        aria-describedby="${id}-facts">
      <div class="choice-body">
        <label class="choice-label" for="${id}"><span data-external-text>${page.name}</span></label>
        <p class="choice-facts" id="${id}-facts">
          ${page.official ? html`<span class="badge">Official page</span>` : ""}
          ${page.core ? html`<span class="badge">Core page</span>` : ""}
          ${facts.map((fact, index) => html`${index > 0 ? " · " : ""}<span class="fact">${fact}</span>`)}
        </p>
        <p class="choice-link">
          <a href="${clashfinderPageAddress(page.id)}" target="_blank" rel="noopener">Open
            <span data-external-text>${page.id}</span> on Clashfinder</a>
        </p>
      </div>
    </div>
  `;
}
