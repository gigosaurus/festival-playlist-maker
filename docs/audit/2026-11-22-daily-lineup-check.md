# Audit record: Daily lineup check

| Item | Value |
|---|---|
| Date | 22 November 2026 |
| Change | #17. The application checks the lineup of each published festival once a day until the festival starts. The check runs on a schedule in the same process. Each lineup check records the new names and the removed names with its time. Manage festivals shows the last lineup change, with a link from each new name to its row on Admin: artist matches, where it has the badge "New". A source failure shows its time and cause, and the stored lineup does not change. A published festival stays published. The admin can change the lineup source on the new page Change the lineup source. ADR-0006 and ADR-0007 permit the daily check. |
| Pages in scope | Manage festivals (`/admin/festivals`): the facts "Lineup check" and "Last lineup change", the link "Change the lineup source", the notices after a change of the lineup source. Change the lineup source (`/admin/festivals/{id}/lineup-source`): before a search, with results, with a problem. Admin: artist matches: the badge "New". The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-20-update-the-playlist.md](2026-11-20-update-the-playlist.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the page states of the previous record and on 6 new states: "Manage festivals, lineup check with new names", "Manage festivals, lineup check failed", "Artist matches, new names after a lineup check", "Change the lineup source", "Change the lineup source, search results" and "Manage festivals, lineup source changed", at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/lineup-check.spec.ts` has 5 new tests, at desktop and mobile sizes. They run the scheduled check with the fake clock: no request on the day of the last lineup, one request on the next day, no second request on the same day. They check the new and removed names, the link to Admin: artist matches and the badge, a source failure, a change of the lineup source with and without a choice, a change that fails, and the permission-restricted state. They include 5 axe WCAG 2.2 AA scans.
- **Module tests:** `test/modules/lineup-check.test.ts` has 12 new tests: new names and removed names with the time of the check, no changes for the first lineup, a check without changes, a name that comes back, a source failure, once a day also after a failure, midnight in the United Kingdom, a check by the admin, the end of the checks when the festival starts, no check before publication, a maximum of 5 checks in one run, and a change of the lineup source.
- **Screenshots:** Manage festivals after a check with 8 new names and 15 removed names (the list stops at 10 names), Admin: artist matches opened at a new name, and Change the lineup source before a search, with a problem and after the change. At 1280 px and on Pixel 7. No horizontal scrolling.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

The results of the previous record stay correct, except for the rows below.

| ID | Result | Evidence |
|---|---|---|
| IA-02 | Pass | Page-to-task map: Manage festivals now also supports user stories 47 to 49 and 52. The new page Change the lineup source supports user story 50. |
| IA-03 | Pass | The notice after an action gives the numbers of the change. The fact "Last lineup change" gives the names. The failure notice after a change of the source does not repeat the cause. |
| IA-04 | Pass | Change the lineup source: the current source, then the search, then the choices, then the action. |
| IA-05 | Pass | The link "Change the lineup source" and the page title agree. |
| LY-01 | Pass | The facts "Lineup check" and "Last lineup change" show only when they apply. Each list of a change stops at 10 names, because a change of the source can remove all names. |
| LY-04 | Pass | The link "Change the lineup source" is a link, not a button, because it is not the principal action of the festival. |
| VS-02 | Pass | No new type style. The facts and the badge use their existing styles. |
| VS-05 | Pass | Standards test (axe colour contrast) on the 6 new states, and axe scans in the page tests. |
| DC-04 | Pass | The badge "New" on Admin: artist matches gives a specific state: the last lineup change added the name. |
| DC-06 | Pass | The new page uses the components of Add a festival. The fact value has a second line, recorded in the Facts component role. |
| CT-01 | Pass | "Each day until the festival starts" states when the checks stop. |
| CT-04 | Pass | "Change the lineup source" opens the page and, on the page, changes the source and gets the lineup (page test). Each new name opens its row (page test). |
| CT-05 | Pass | "Lineup check" is in the glossary. "Lineup", "Lineup source" and "Artist match" agree with the glossary. |
| IN-01 | Pass | Page tests use each new link and button. |
| IN-06 | Pass | The search on Change the lineup source is a GET request, so Back and refresh show the same results. The change is a POST request with a redirect. |
| FN-02 | Pass | The notice after a change of the source reads the result from the database. A failure gives the failure notice (page test). |
| FN-03 | Pass | "Change the lineup source" without a choice gives the error summary with a link to the choices (page test). |
| FN-04 | Pass | Change the lineup source: before a search, with results, problem, success, failure and permission-restricted (page tests). A search without results and a search failure use the shared page choices, which the Add a festival tests cover. The scheduled check has no loading state, because it runs in the background. Its result shows on Manage festivals. |
| FN-06 | Pass | The changes and the problems are in the database. They stay after a reload and a restart. |
| QA-01 | Pass | The facts wrap on Pixel 7 (screenshots). |
| QA-03 | Pass | The new links and controls are native elements with the focus indicator. |
| PB-01 | Pass | Change the lineup source and Add a festival use the same search and page choices (`src/pages/clashfinder-choices.ts`). |
| PB-03 | Pass | Each new name links to `/admin/festivals/{id}/artist-matches#name-{lineup name id}`, and the row has this ID (page test). |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | "Each day until the festival starts" answers "do I still need to get the lineup again?". |
| CP-03 | Pass | "Changed the lineup source of Download 2027" comes before the number of names and the changes. |
| CP-07 | Pass | The page does not explain that a check by the admin counts for the day, or that matches stay after a change of the source, because nothing on the page gives a reason to ask. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The page brief of Change the lineup source, and the changed brief of Manage festivals, in the design spec. |
| ED-02 | Pass | The design spec gives the question of each new text. |
| ED-03 | Pass | The content tables in the design spec, with the removed content (the time of each check without changes, a warning about publication). |
| ED-04 | Pass | The schedule and the request limit show only as their consequence: "Each day until the festival starts". |
| ED-05 | Pass | "Publish" and "Get the lineup again" keep their emphasis. "Change the lineup source" is a small link. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Publish Download 2027 with 3 artists. Run the scheduled check on the same day. Clashfinder gets no request. | Pass |
| Run the check on the next day. Manage festivals shows "Published", "Lineup check: Each day until the festival starts", and "Last lineup change" with 8 new names and 1 removed name. | Pass |
| Run the check again on the same day. Clashfinder gets no second request. | Pass |
| Select the new name "Bring Me The Horizon". Admin: artist matches opens at its row, with the badge "New". Turnstile has no badge. | Pass |
| Clashfinder gives status 503 in the check. The festival shows the time and the cause, keeps its 3 names, and stays published. | Pass |
| Select "Change the lineup source". Search. Select "Change the lineup source" without a choice: the error summary has focus. Choose "Download Festival 2027" and select it again. The notice gives 10 names and the changes, and the next check uses the new page. | Pass |
| Look at each state at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. Clashfinder was a fake with the recorded responses in `test/fixtures/clashfinder/`. The timer in `src/main.ts` was not run for a full day. The module tests and the page tests run the scheduled task with the fake clock.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- A lineup check that Clashfinder refuses because of the request limit is recorded as a failure, and the next check is on the next day. The admin can select "Get the lineup again".
- A lineup from before this change has no recorded changes. The first lineup check after the change records the changes from that lineup.
- Version 1 has one lineup source. The choice of a festival app API source comes with #20.
- The outstanding items from the previous record, except #17.
