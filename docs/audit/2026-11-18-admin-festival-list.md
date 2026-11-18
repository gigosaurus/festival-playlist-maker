# Audit record: admin festival list

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Admin adds a festival with a Clashfinder lineup source (#6): Manage festivals, Add a festival, Clashfinder search, lineup source, signed and paced Clashfinder requests |
| Pages in scope | Manage festivals (`/admin/festivals`): empty, festival added with its lineup, festival added without a lineup, lineup failed. Add a festival (`/admin/festivals/new`): empty, problems, search results, search without results, search failed. The site header, which now has "Manage festivals" for the admin. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-spotify-log-in.md](2026-11-18-spotify-log-in.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on 15 pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/admin-festivals.spec.ts`, `test/e2e/festivals-page.spec.ts` and `test/e2e/log-in.spec.ts`. They include an axe WCAG 2.2 AA scan of each admin page state. The admin tests use recorded Clashfinder responses through the fake HTTP client.
- **Module tests:** `test/modules/clashfinder.test.ts` (recorded Clashfinder responses), `test/modules/http-client.test.ts`, `test/modules/festival-form.test.ts`, `test/modules/lineups.test.ts`, and the earlier module tests.
- **Screenshots:** each admin page state at 360, 768 and 1440 px width, keyboard focus on "Get the lineup", and the pointer on it. No page has horizontal scrolling at these widths. A fact in the search results does not break across two lines.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of each admin page shows the page title and the principal action. The admin enters from the header link or from the previous action. |
| IA-02 | Pass | Page-to-task map in the design spec. |
| IA-03 | Pass | A failure notice on Manage festivals does not repeat the cause, because the festival shows it. A name match is not also in the date-match group. |
| IA-04 | Pass | Add a festival: festival values, then the lineup source search, then the choice, then "Add the festival". Manage festivals: result of the last action, principal action, festivals. |
| IA-05 | Pass | The header link "Manage festivals" opens the page with the title "Manage festivals". The link above "Add a festival" has the same text. |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The pages show only the actual content. There is no lineup source control, because version 1 has one lineup source. |
| LY-02 | Pass | Festival panels: separate festivals that the admin scans. Page choices: separate Clashfinder pages that the admin compares and selects. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | The principal action is a filled button: "Add a festival", "Search Clashfinder" before a search, "Add the festival" after it. Secondary actions have only a border. |
| LY-05 | Pass | Screenshots at 360, 768 and 1440 px. The search results are the longest content. They are limited to 20 pages in each group. |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | The type styles table has the new hint, label, field problem, choice label and header link styles. They agree with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | Colour roles in the design spec. The problem colour now also has field problem text. Success is only a strip. Selected and badge are backgrounds. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each admin state. Ratios in the design spec. |
| VS-06 | Pass | Standards test. Labels and badges use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | Strips show state: problem, success, field with a problem, inline problem. Panel borders show grouping. The 2px border shows the chosen page. Component roles table in the design spec. |
| DC-04 | Pass | Badges give specific information: "Core page", "Official page" (Clashfinder marks) and the status "Not published". |
| DC-05 | Pass | No new icons. |
| DC-06 | Pass | Component roles table: panels 12px, controls 8px, badges 4px. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | Each text is specific: Clashfinder, the settings names, the festival dates. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | The failure notice and the festival panel do not repeat the cause. |
| CT-04 | Pass | "Add a festival" opens the form. "Search Clashfinder" shows the results. "Add the festival" adds it. "Get the lineup again" gets the lineup. "Open … on Clashfinder" opens the page (page tests). |
| CT-05 | Pass | British English. Dates as "11 June 2027". Times in UK time as "15 January 2027 at 12:00". The terms agree with the glossary: festival, lineup, lineup source, expected genre, admin. |
| CT-06 | Pass | Standards test. The hint "for example: metal, hard rock, metalcore" is an instruction, not example data. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 to IM-06 | Not applicable | No images, testimonials or statistics. The number of acts and stages comes from Clashfinder and shows as a fact of the page. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | Page tests use each control. |
| IN-02 | Pass | Badges, status labels and festival panels have no pointer cursor and no hover change. The page-choice label has a pointer cursor because it selects the radio button. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is still empty. |
| IN-05 | Not applicable | No counters, typing effects or transitions. |
| IN-06 | Pass | The search is a GET request with an address. After a POST, the application sends the browser to Manage festivals (status 303), so a refresh does not add the festival again. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The workflow completes in the page tests with recorded Clashfinder responses, and with `npm start` against the production Clashfinder API (release test record below). |
| FN-02 | Pass | The confirmation reads the lineup state from the database. When Clashfinder fails, the page shows "Added … without a lineup", not a success (page test). |
| FN-03 | Pass | Missing, incorrect and out-of-range values each give a message that tells the admin how to correct the value (module and page tests). The values stay. The error summary links to each field. |
| FN-04 | Pass | Empty: "There are no festivals", and a search without results. Error: search failure, lineup failure. Success: confirmation. Permission-restricted: a user who is not the admin gets status 403 on each admin page and each admin form action (page test). Loading: the browser loading state, see the design spec. Unavailable: the request limit gives a cause with the time to wait. |
| FN-05 | Pass | The search finds known pages by name, by ID and by address, and pages on the festival dates. A search without results shows the empty state (module and page tests). |
| FN-06 | Pass | Festivals and lineups are in the database. The page does not tell the admin a period. |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. Screenshots at 360, 768 and 1440 px. |
| QA-02 | Pass | Long page names, long IDs and long causes break inside their panel (screenshots). The search results are limited to 20 pages in each group. |
| QA-03 | Pass | Page test: the admin adds a festival with the keyboard. Enter in the search field starts the search. The radio buttons and the buttons have a visible outline. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set. |
| QA-06 | Pass | The header is not fixed. No overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | All pages use the same layout. Only the admin sees "Manage festivals" in the header. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | Each link goes to its destination. The Clashfinder links go to `https://clashfinder.com/s/<page ID>/`. |
| PB-04 | Pass | Standards test on each admin state. |
| PB-05 | Pass | The admin states are in the standards test and the axe scan. |
| PB-06 | Pass, with outstanding items | Release test record below. The outstanding items come from the previous record. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The search hint explains why pages with a different name show. The lineup problem tells the admin if the festival kept its lineup. |
| CP-02 | Pass | Direct wording. |
| CP-03 | Pass | "Added Download 2027" and "Got the lineup of Download 2027" come first, then the number of lineup names. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | The empty-state text about publication was removed. Page briefs give the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables in the design spec. |
| ED-04 | Pass | A key failure names the two settings to check. The crawl delay and the request limit show as a wait and a time to try again. |
| ED-05 | Pass | The principal action has the filled button. Supporting detail (genres, Clashfinder links) is smaller or secondary. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Pass | The failure notice was made shorter. The cause stays with the festival. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| As the admin, open "Manage festivals" from the header. The empty state shows. | Pass |
| Add a festival from a Clashfinder search. The confirmation gives the number of lineup names. The panel shows the dates, the source, the lineup and the genres. | Pass |
| Search for "Download" with the dates 11–13 June 2027. Pages with a different name on those dates show in a separate group. | Pass |
| Search for "Slam Dunk" 2026. The duplicate pages show their dates, sizes, last change and "Core page". | Pass |
| Paste a Clashfinder address. That page is first. | Pass |
| Submit missing and incorrect values. Each problem shows, the summary has focus, and its links go to the fields. | Pass |
| Add a festival while Clashfinder refuses the key. The festival is added without a lineup, and the cause shows. Get the lineup again with a working response, then with a failure. The festival keeps the 10 lineup names. | Pass |
| Add the same festival two times. The second time gives a problem. | Pass |
| Add a festival with the keyboard only. | Pass |
| As a user who is not the admin, open the admin pages and send the admin forms. Each gives status 403. | Pass |
| Look at each admin state at 360, 768 and 1440 px. Nothing overlaps or is cut off. | Pass |
| Send signed requests to the production Clashfinder API for the list and two exports. | Pass. On 18 November 2026, the requests had the key of the admin account and a 10-second pause. These responses are the recorded test responses. |
| Add a festival with `npm start` and the real Clashfinder account. | Pass. The project owner added a festival for 11–13 June 2027 with the page `download27` on 18 November 2026 at 17:49 (UTC). The database has 10 lineup names and 14 set times, each with a stage, a start time and an end time, and the timezone Europe/London. The last attempt has no problem. The names agree with the recorded response `event-download27.json`. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
