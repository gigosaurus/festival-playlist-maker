# Audit record: Interest levels

| Item | Value |
|---|---|
| Date | 19 November 2026 |
| Change | Interest levels on the Festival page (#10): the genres and the interest level of each artist, one action to set a level, the search, the filter and the sort, and the number of artists in the playlist |
| Pages in scope | Festival (`/festivals/{id}`): 150 artists, levels changed, search without results, filter without results, list out of date, failed save, without JavaScript, saved without JavaScript. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-publish-festival.md](2026-11-18-publish-festival.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on 30 pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. The new states are the Festival page with 150 artists, with a search without results, and after a save without JavaScript. All checks passed.
- **Page tests:** `test/e2e/festival-page.spec.ts` uses a published festival with 150 artists and 2 names marked "no match" (`test/e2e/large-lineup.ts`). It covers the list, one action for each level, a reload, a new session, a different user, fast changes, the search, the filter and the sort together, empty results, the out-of-date list, the keyboard, a failed save, a refused request and a browser without JavaScript. It includes axe WCAG 2.2 AA scans of five states. The page tests of the previous record also pass.
- **Module tests:** `test/modules/interest-levels.test.ts` (Curious as the default, names marked "no match", levels for each user, a save for a name that is not on the lineup, a level after a lineup change), and the earlier module tests.
- **Screenshots:** the Festival page with changed levels, keyboard focus on a level, a search without results, the out-of-date list and a failed save, at 1280 px and on Pixel 7. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of the Festival page shows the link back, the festival, the dates, the playlist count, the tools and the first artists. |
| IA-02 | Pass | Page-to-task map in the design spec. The Festival page supports the interest levels. #15 adds the playlist. |
| IA-03 | Pass | The list count and the playlist count give different numbers. The out-of-date text shows only when the list does not agree with the filter or the sort. |
| IA-04 | Pass | Festival page: the festival, the playlist count, then the tools, then the artists. The user finds an artist before setting its level. |
| IA-05 | Pass | "Festivals" on the Festival page opens the Festivals page. |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The Festival page shows only the artists with an artist match. An artist without genres has no empty genre line. |
| LY-02 | Pass | The lineup is a list with dividers, not a card grid. The interest levels are four segments of one control. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | The artist name is the strongest text in a row. The chosen level has the link colour and a 2px border. The genres and the counts are muted or body text. |
| LY-05 | Pass | One row is approximately 72px high at 1280 px, so a desktop screen shows 7 artists below the tools. On Pixel 7, the levels go below the name (screenshots). |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | New type styles: playlist count, artist name, artist genres, interest level (type styles table). They agree with the rendered page. |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | The chosen interest level uses the link border and the selected background, as the chosen page choice does. The failed save uses the problem colour. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each new page state. Link on Selected is 6.71:1. The 2px link border of the chosen level is 6.81:1 on the page. |
| VS-06 | Pass | Standards test. Labels use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | The rule lines separate the artists. The segment border shows a control. The link border shows the chosen level. Component roles table in the design spec. |
| DC-04 | Not applicable | No new badges. |
| DC-05 | Pass | No new icons. |
| DC-06 | Pass | The segments have the control radius, 8px. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | The empty-result texts name the search text or the level. The out-of-date text names the consequence and the action. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | No text repeats an earlier text. |
| CT-04 | Pass | "Show all artists" clears the search and the filter. "Update the list" applies them again. "Save the interest levels" saves the form (page tests). |
| CT-05 | Pass | British English. The level names agree with the glossary: Not interested, Curious, Keen, Must see. |
| CT-06 | Pass | Standards test. The test artist names are only in the tests. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 to IM-06 | Not applicable | No images, testimonials or statistics. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | Page tests use each control: each level, the search, both selects, "Show all artists", "Update the list" and "Save the interest levels". Without the script, the tools do not show, because they do not operate. |
| IN-02 | Pass | Only the interest levels have a pointer change. The artist rows have none. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is still empty. The list changes order without animation. |
| IN-05 | Pass | The playlist count changes after the save, with no counter effect. |
| IN-06 | Pass | The address keeps the search, the filter and the sort, so a reload shows the same list (page test). The script replaces the address, so Back opens the previous page, not each search step. Without JavaScript, the save sends the browser to the Festival page (status 303), so a refresh does not send the form again. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The workflow completes in the page tests against the test server with a real database. |
| FN-02 | Pass | The playlist count changes only after a successful save. A failed save shows the saved level and the problem (page test with status 500). The notice "Saved the interest levels" shows only after the redirect from a successful save. |
| FN-03 | Pass | A level that is not valid, or a name that is not an artist on the lineup, gives status 400 and saves nothing (page test, module test). The interface cannot send such a request. |
| FN-04 | Pass | Empty: the search and filter texts and "Show all artists". Error: the failed save. Success: the playlist count, and the notice without JavaScript. Unavailable: the tools without JavaScript. Permission-restricted: a festival that is not published gives Page not found, and its save gives status 404. |
| FN-05 | Pass | Page tests: a search that ignores accents and case, the filter, the sort, the three together, the address, and searches and filters without results. A change does not move an artist until "Update the list". |
| FN-06 | Pass | The levels are in the database for each user. They stay after a reload and in a new session, and a different user does not see them (page tests). |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. Below 48rem, the levels go below the name. On Pixel 7, "Not interested" goes onto two lines in its segment, and the segments keep equal widths. |
| QA-02 | Pass | 150 artists in the page tests. A long name wraps (`overflow-wrap: anywhere`). The page loads in less than 0.1 seconds in the test browser. |
| QA-03 | Pass | Page test: the user moves to the search, types, moves through the selects to an artist, and changes the level with an arrow key. The segment shows the focus indicator. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set. |
| QA-06 | Pass | The header and the tools are not fixed. No overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | The chosen level has the same treatment as the chosen page choice. The inputs, the secondary buttons and the field problem use the shared components. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | The save address is `/festivals/{id}/interest-levels`. A festival that is not published gives Page not found. |
| PB-04 | Pass | Standards test on each new page state. |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. The outstanding items come from the previous record. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The out-of-date text answers "why does this artist not agree with the filter?". The failed save answers "was it saved?". |
| CP-02 | Pass | Direct wording. |
| CP-03 | Pass | "Saved the interest levels" states the completed action. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | No text explains the default level, the save or the search. The page brief gives the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The Festival page brief in the design spec. |
| ED-02 | Pass | Page brief: each explanation has its question. |
| ED-03 | Pass | Content table in the design spec. The playlist count is above the lineup, before the levels. |
| ED-04 | Pass | The save happens in the background. The user sees only the result: the level stays, or the problem shows. |
| ED-05 | Pass | The interest levels fill the right side of each row and have the strongest colour. The tools are smaller than the list. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Open the Festival page of a festival with 150 artists. Each artist shows its genres and Curious. The names marked "no match" do not show. | Pass |
| Set Must see for one artist and Not interested for another, with one selection each. The playlist count changes to 149 of 150. Reload. Log out, log in again. The levels stay. | Pass |
| Log in as a different user. The artist shows Curious. | Pass |
| Change one level five times fast with the arrow keys. After a reload, the last level shows. | Pass |
| Search "motley crue". Mötley Crüe shows. Search "iron", sort by interest level, filter Must see. The list and the counts agree. Reload. The same list shows. | Pass |
| Search "nobody". The page says that no artist matches, and "Show all artists" shows the full lineup. | Pass |
| Filter Curious and set Keen for one artist. The artist stays, and "Update the list" shows. Select it. The artist goes. | Pass |
| Make the save fail. The artist shows Curious and the problem. Select a level again with the save available. The problem goes. | Pass |
| Use only the keyboard to search and set a level. The focus indicator is visible. | Pass |
| Turn off JavaScript. The tools do not show. Set two levels and select "Save the interest levels". The notice shows, and the levels stay. | Pass |
| Look at the new states at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass. The first screenshots showed "Not interested" on two lines at 1280 px. The segments are now 8rem wide. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
