import { html } from "hono/html";
import { clashfinderPageAddress } from "../clashfinder.ts";
import type { AdminFestival } from "../festivals.ts";
import type { LineupChange } from "../lineups.ts";
import type { User } from "../sessions.ts";
import { count, formatDateAndTime, formatDateRange } from "./format.ts";
import { layout } from "./layout.ts";

// The result of the last action of the admin on this page, or on Change the lineup source.
// "publish": the admin selected "Publish". The page reads the result from the festival.
export type LastAction = { action: "added" | "got-lineup" | "changed-source" | "publish"; festival: AdminFestival };

export interface AdminFestivalsPageState {
  festivals: AdminFestival[];
  lastAction: LastAction | undefined;
  // For each festival ID, the number of current lineup names without an artist match.
  unmatchedNames: ReadonlyMap<number, number>;
  // For each festival ID, the last lineup check that changed the lineup.
  lineupChanges: ReadonlyMap<number, LineupChange>;
  // The ISO date in the United Kingdom.
  today: string;
}

// The maximum number of names in each list of a lineup change. A change of the
// lineup source can remove all of the names.
export const maximumChangeNames = 10;

export function adminFestivalsPage(user: User, state: AdminFestivalsPageState) {
  const { festivals, lastAction } = state;
  return layout({
    title: "Manage festivals",
    description: "Add festivals and get their lineups from the lineup source.",
    user,
    body: html`
      <h1>Manage festivals</h1>
      ${lastAction ? lastActionNotice(lastAction, state.lineupChanges.get(lastAction.festival.id)) : ""}
      <p><a class="button" href="/admin/festivals/new">Add a festival</a></p>
      ${festivals.length === 0 ? emptyState() : festivalList(state)}
    `,
  });
}

function emptyState() {
  return html`
    <section class="empty-state" aria-labelledby="empty-state-heading">
      <h2 id="empty-state-heading">There are no festivals</h2>
    </section>
  `;
}

function festivalList(state: AdminFestivalsPageState) {
  return html`
    <ul class="admin-festival-list">
      ${state.festivals.map((festival) => html`<li>${festivalItem(festival, state)}</li>`)}
    </ul>
  `;
}

function festivalItem(festival: AdminFestival, state: AdminFestivalsPageState) {
  const title = festivalTitle(festival);
  const source = festival.lineupSource;
  const unmatched = state.unmatchedNames.get(festival.id) ?? 0;
  const change = state.lineupChanges.get(festival.id);
  // The daily lineup check (user story 47).
  const checked = festival.published && festival.startDate > state.today;
  return html`
    <article class="admin-festival" aria-labelledby="festival-${festival.id}">
      <div class="admin-festival-heading">
        <h2 id="festival-${festival.id}"><span data-external-text>${title}</span></h2>
        <span class="status-label">${festival.published ? "Published" : "Not published"}</span>
      </div>
      <p class="festival-dates">${formatDateRange(festival.startDate, festival.endDate)}</p>
      <dl class="facts">
        <div>
          <dt>Lineup source</dt>
          <dd>
            Clashfinder:
            <a href="${clashfinderPageAddress(source.page)}" data-external-text>${source.pageName}</a>
            <span class="fact-action"><a href="/admin/festivals/${festival.id}/lineup-source">Change the lineup source<span
              class="visually-hidden"> of <span data-external-text>${title}</span></span></a></span>
          </dd>
        </div>
        <div>
          <dt>Lineup</dt>
          <dd>${lineupState(festival)}</dd>
        </div>
        ${checked
          ? html`<div>
              <dt>Lineup check</dt>
              <dd>Each day until the festival starts</dd>
            </div>`
          : ""}
        ${change ? html`<div>
              <dt>Last lineup change</dt>
              <dd>${lineupChange(festival, change)}</dd>
            </div>` : ""}
        ${festival.lineupNames > 0
          ? html`<div>
              <dt>Artist matches</dt>
              <dd>${artistMatchState(festival, unmatched)}</dd>
            </div>`
          : ""}
        <div>
          <dt>Expected genres</dt>
          <dd data-external-text>${festival.expectedGenres.join(", ")}</dd>
        </div>
      </dl>
      ${festival.lineupProblem ? lineupProblem(festival, festival.lineupProblem) : ""}
      ${festival.published ? "" : publication(festival, unmatched)}
      <form method="post" action="/admin/festivals/${festival.id}/lineup">
        <button class="button-secondary" type="submit">
          ${festival.lineupUpdatedAt ? "Get the lineup again" : "Get the lineup"}<span class="visually-hidden">
            for <span data-external-text>${title}</span></span>
        </button>
      </form>
    </article>
  `;
}

// The publish action shows only when the admin can publish the festival (user story 51).
// Before that, the text tells the admin what to do first. The Artist matches fact above gives the number.
function publication(festival: AdminFestival, unmatched: number) {
  if (festival.lineupNames === 0) {
    return html`<p class="publication-hint">You can publish the festival when it has a lineup.</p>`;
  }
  if (unmatched > 0) {
    return html`<p class="publication-hint">
      You can publish the festival when each lineup name has an artist match or a “no match” mark.
    </p>`;
  }
  return html`
    <form class="publication" method="post" action="/admin/festivals/${festival.id}/publish">
      <button class="button" type="submit">
        Publish<span class="visually-hidden"> <span data-external-text>${festivalTitle(festival)}</span></span>
      </button>
    </form>
  `;
}

function lineupState(festival: AdminFestival) {
  if (festival.lineupUpdatedAt === undefined) return "No lineup";
  return `${count(festival.lineupNames, "lineup name", "lineup names")}, from ${formatDateAndTime(festival.lineupUpdatedAt)}`;
}

// The new names and the removed names of the last lineup check that changed the
// lineup (user story 48). Each new name opens on Admin: artist matches.
function lineupChange(festival: AdminFestival, change: LineupChange) {
  const names = <T>(list: T[], show: (item: T) => unknown) => {
    const shown = list.slice(0, maximumChangeNames);
    const more = list.length - shown.length;
    return html`${shown.map((item, index) => html`${index > 0 ? ", " : ""}${show(item)}`)}${more > 0 ? ` and ${more} more` : ""}`;
  };
  return html`
    <span class="change-time">${formatDateAndTime(change.at)}</span>
    ${change.newNames.length > 0
      ? html`<span class="change-names">${count(change.newNames.length, "new name", "new names")}:
          ${names(change.newNames, (name) => html`<a href="/admin/festivals/${festival.id}/artist-matches#name-${name.lineupNameId}"
            data-external-text>${name.name}</a>`)}</span>`
      : ""}
    ${change.removedNames.length > 0
      ? html`<span class="change-names">${count(change.removedNames.length, "removed name", "removed names")}:
          ${names(change.removedNames, (name) => html`<span data-external-text>${name.name}</span>`)}</span>`
      : ""}
  `;
}

function artistMatchState(festival: AdminFestival, unmatched: number) {
  const link = (text: string) =>
    html`<a href="/admin/festivals/${festival.id}/artist-matches">${text}<span class="visually-hidden"> for
      <span data-external-text>${festivalTitle(festival)}</span></span></a>`;
  if (unmatched === 0) return html`Each lineup name has an artist match. ${link("Show the artist matches")}`;
  return html`${count(unmatched, "lineup name has", "lineup names have")} no artist match. ${link("Match the artists")}`;
}

// The last attempt failed. The festival keeps the lineup from before.
function lineupProblem(festival: AdminFestival, problem: { at: Date; cause: string }) {
  return html`
    <div class="inline-problem">
      <p><strong>The application did not get the lineup on ${formatDateAndTime(problem.at)}.</strong></p>
      <p class="problem-cause" data-external-text>${problem.cause}</p>
      <p>${festival.lineupUpdatedAt ? "The festival keeps its previous lineup." : "The festival has no lineup."}</p>
    </div>
  `;
}

// change: the last lineup change of the festival. The notice gives its numbers
// only when the action made it.
function lastActionNotice({ action, festival }: LastAction, change: LineupChange | undefined) {
  const title = festivalTitle(festival);
  if (action === "publish") return publishNotice(festival);
  const failed = festival.lineupProblem !== undefined;
  const names = count(festival.lineupNames, "lineup name", "lineup names");
  const changeText =
    change !== undefined && change.at.getTime() === festival.lineupUpdatedAt?.getTime() ? ` ${changeSummary(change)}` : "";
  if (action === "added" && !failed) {
    return confirmation(html`Added <span data-external-text>${title}</span>`, `Got ${names} from Clashfinder.`);
  }
  if (action === "got-lineup" && !failed) {
    return confirmation(html`Got the lineup of <span data-external-text>${title}</span>`, `${names} from Clashfinder.${changeText}`);
  }
  if (action === "changed-source" && !failed) {
    return confirmation(html`Changed the lineup source of <span data-external-text>${title}</span>`, `Got ${names} from Clashfinder.${changeText}`);
  }
  if (action === "changed-source") {
    return html`
      <section class="notice" aria-labelledby="last-action-heading">
        <h2 id="last-action-heading">Changed the lineup source of <span data-external-text>${title}</span></h2>
        <p>The application did not get the lineup from the new source. The cause is with the festival in the list.</p>
      </section>
    `;
  }
  const heading =
    action === "added"
      ? html`Added <span data-external-text>${title}</span> without a lineup`
      : html`The application did not get the lineup of <span data-external-text>${title}</span>`;
  // The festival in the list shows the cause, so the notice does not repeat it.
  return html`
    <section class="notice" aria-labelledby="last-action-heading">
      <h2 id="last-action-heading">${heading}</h2>
      <p>The cause is with the festival in the list.</p>
    </section>
  `;
}

// The festival is published, or the admin cannot publish it yet. The cause of the
// second result is with the festival in the list.
function publishNotice(festival: AdminFestival) {
  const title = festivalTitle(festival);
  if (festival.published) {
    return confirmation(html`Published <span data-external-text>${title}</span>`, "Users can see it on the Festivals page.");
  }
  return html`
    <section class="notice" aria-labelledby="last-action-heading">
      <h2 id="last-action-heading">The application did not publish <span data-external-text>${title}</span></h2>
      <p>The cause is with the festival in the list.</p>
    </section>
  `;
}

function confirmation(heading: ReturnType<typeof html>, text: string) {
  return html`
    <section class="notice notice-success" aria-labelledby="last-action-heading">
      <h2 id="last-action-heading">${heading}</h2>
      <p>${text}</p>
    </section>
  `;
}

// For example "The lineup check found 2 new names and 1 removed name."
function changeSummary(change: LineupChange): string {
  const parts = [
    change.newNames.length > 0 ? count(change.newNames.length, "new name", "new names") : undefined,
    change.removedNames.length > 0 ? count(change.removedNames.length, "removed name", "removed names") : undefined,
  ].filter(Boolean);
  return `The lineup check found ${parts.join(" and ")}.`;
}

// The playlist name has the same form, for example "Download 2027".
function festivalTitle(festival: { name: string; year: number }): string {
  return `${festival.name} ${festival.year}`;
}
