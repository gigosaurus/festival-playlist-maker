import { html } from "hono/html";
import { clashfinderPageAddress, maximumResults, type ClashfinderPage, type SearchResult } from "../clashfinder.ts";
import { festivalFields, type FestivalField, type FestivalFormValues, type FieldProblems } from "../festival-form.ts";
import type { User } from "../sessions.ts";
import { count, formatDate } from "./format.ts";
import { layout } from "./layout.ts";

export interface AddFestivalPageState {
  values: FestivalFormValues;
  problems: FieldProblems;
  // The search text that the search used, and its result. Undefined before the first search.
  search?: { text: string; result: SearchResult; hasDates: boolean };
}

export function addFestivalPage(user: User, { values, problems, search }: AddFestivalPageState) {
  const hasProblems = Object.keys(problems).length > 0;
  const hasResults =
    search?.result.outcome === "found" && search.result.nameMatches.length + search.result.dateMatches.length > 0;
  return layout({
    title: hasProblems ? "Error: Add a festival" : "Add a festival",
    description: "Add a festival and choose the Clashfinder page that gives its lineup.",
    user,
    body: html`
      <p class="back-link"><a href="/admin/festivals">Manage festivals</a></p>
      <h1>Add a festival</h1>
      ${hasProblems ? errorSummary(problems) : ""}
      <form class="festival-form" method="post" action="/admin/festivals" novalidate>
        ${textField("name", "Name", values.name, problems, { autocomplete: "off" })}
        ${textField("year", "Year", values.year, problems, { inputmode: "numeric", size: "4" })}
        <fieldset class="field-group">
          <legend>Dates</legend>
          <div class="date-fields">
            ${textField("startDate", "First day", values.startDate, problems, { type: "date" })}
            ${textField("endDate", "Last day", values.endDate, problems, { type: "date" })}
          </div>
        </fieldset>
        ${textField("expectedGenres", "Expected genres", values.expectedGenres, problems, {
          hint: "Separate the genres with commas, for example: metal, hard rock, metalcore.",
          autocomplete: "off",
        })}

        <section class="lineup-source" aria-labelledby="lineup-source-heading">
          <h2 id="lineup-source-heading">Lineup source: Clashfinder</h2>
          <div class="field">
            <label class="label" for="search">Name or address of the Clashfinder page</label>
            <p class="hint" id="search-hint">
              The search also shows pages with a different name that start on the festival dates.
            </p>
            <div class="search-row">
              <input class="input" id="search" name="search" type="search" value="${values.search}" aria-describedby="search-hint" autocomplete="off">
              <button class="${hasResults ? "button-secondary" : "button"}" type="submit" formmethod="get" formaction="/admin/festivals/new" formnovalidate>
                Search Clashfinder
              </button>
            </div>
          </div>
          ${search ? searchResults(search, values.page, problems.page) : pageProblemBeforeSearch(problems.page)}
        </section>

        ${hasResults ? html`<button class="button" type="submit">Add the festival</button>` : ""}
      </form>
    `,
  });
}

function errorSummary(problems: FieldProblems) {
  return html`
    <section class="notice error-summary" aria-labelledby="error-summary-heading" tabindex="-1" data-error-summary>
      <h2 id="error-summary-heading">Correct the problems to add the festival</h2>
      <ul>
        ${festivalFields
          .filter((field) => problems[field] !== undefined)
          .map((field) => html`<li><a href="#${fieldTarget(field)}">${problems[field]}</a></li>`)}
      </ul>
    </section>
    <script>document.querySelector("[data-error-summary]").focus();</script>
  `;
}

// The element that a link in the error summary goes to.
function fieldTarget(field: FestivalField): string {
  return field === "page" ? "page-choices" : field;
}

interface FieldOptions {
  type?: string;
  hint?: string;
  inputmode?: string;
  size?: string;
  autocomplete?: string;
}

function textField(field: FestivalField, label: string, value: string, problems: FieldProblems, options: FieldOptions = {}) {
  const problem = problems[field];
  const describedBy = [options.hint ? `${field}-hint` : "", problem ? `${field}-problem` : ""].filter(Boolean).join(" ");
  return html`
    <div class="field${problem ? " field-with-problem" : ""}">
      <label class="label" for="${field}">${label}</label>
      ${options.hint ? html`<p class="hint" id="${field}-hint">${options.hint}</p>` : ""}
      ${problem ? html`<p class="field-problem" id="${field}-problem">${problem}</p>` : ""}
      <input
        class="input${options.type === "date" ? " input-date" : ""}"
        id="${field}"
        name="${field}"
        type="${options.type ?? "text"}"
        value="${value}"
        ${options.inputmode ? html`inputmode="${options.inputmode}"` : ""}
        ${options.size ? html`size="${options.size}"` : ""}
        ${options.autocomplete ? html`autocomplete="${options.autocomplete}"` : ""}
        ${describedBy ? html`aria-describedby="${describedBy}"` : ""}
        ${problem ? html`aria-invalid="true"` : ""}
      >
    </div>
  `;
}

// The admin selected "Add the festival" before a search.
function pageProblemBeforeSearch(problem: string | undefined) {
  if (problem === undefined) return "";
  return html`<p class="field-problem" id="page-choices" tabindex="-1">${problem}</p>`;
}

function searchResults(
  search: NonNullable<AddFestivalPageState["search"]>,
  chosen: string,
  problem: string | undefined,
) {
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
