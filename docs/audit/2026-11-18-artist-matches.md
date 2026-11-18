# Audit record: artist matches

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Artist match with MusicBrainz (#7): Admin: artist matches, Artist match for one name, the artist matches on Manage festivals, MusicBrainz searches in the background with the User-Agent and 1 request each second |
| Pages in scope | Admin: artist matches (`/admin/festivals/{id}/artist-matches`): searches wait, searches complete, search stopped, after a save, after a save with a genre warning, no lineup. Artist match for one name (`/admin/festivals/{id}/artist-matches/{lineup name id}`): search results, problem, search failed. Manage festivals, which now has the artist matches of each festival. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-admin-festival-list.md](2026-11-18-admin-festival-list.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on 19 pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/admin-artist-matches.spec.ts`, and the page tests of the previous record. They include an axe WCAG 2.2 AA scan of the artist match pages. The tests use recorded Clashfinder and MusicBrainz responses through the fake HTTP client.
- **Module tests:** `test/modules/musicbrainz.test.ts` and `test/modules/artist-matches.test.ts` (recorded MusicBrainz responses: proposal, genre warning, reuse on a second festival, search queue), and the earlier module tests.
- **Screenshots:** Admin: artist matches (searches wait, search stopped, after a save with a genre warning) and Artist match for one name at 1280 px and on Pixel 7. Admin: artist matches with an open group of other artists at 360 and 768 px. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of Admin: artist matches shows the title with the festival, the expected genres and the first name with its proposal. The admin enters from "Match the artists". |
| IA-02 | Pass | Page-to-task map in the design spec. |
| IA-03 | Pass | A name is in one section only: without a match, or in "Artist matches". The notice after a save does not repeat the facts of the artist. |
| IA-04 | Pass | Admin: artist matches: result of the last save, expected genres, names without a match (the principal task), then the matches. Each name: the proposal, "No match", the other artists, then "Save the match". |
| IA-05 | Pass | "Match the artists" opens "Artist matches for Download 2027". "Change" and "Search with a different text" open "Artist match for {name}". The back links have the title of their destination. |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The pages show only the search results. The search gives a maximum of 5 artists. |
| LY-02 | Pass | Artist choices: separate MusicBrainz artists that the admin compares and selects. The matches are a list with dividers, not a card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | "Save the match" is the filled button. "Search MusicBrainz" and "Search again" have only a border. The proposal has the chosen style. |
| LY-05 | Pass | When an artist is chosen, the other artists are in a closed group. This made the page with 10 names half as long (screenshots before and after). |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | The type styles table has the new lineup name heading, genre warning, matched name, matched artist and disclosure label styles. They agree with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | Colour roles in the design spec. The new warning colour is only for genre warnings and the warning notice strip. Problem stays for problems that stop an action. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each artist match state. Warning text ratios (5.39:1 or more) are in the design spec. |
| VS-06 | Pass | Standards test. Labels and badges use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | The warning strip shows a completed action to check. A rule line separates the lineup names, because the choices in them have panels. Component roles table in the design spec. |
| DC-04 | Pass | The badges "Proposed" and "Current match" give the state of a choice. |
| DC-05 | Pass | No new icons. |
| DC-06 | Pass | Component roles table: panels 12px, controls 8px, badges 4px. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | Each text is specific: MusicBrainz, the rate of 1 name each second, the expected genres, the consequence of "No match" for playlists. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | A choice with no genres shows one warning line, not a genre line and a warning that repeat it. |
| CT-04 | Pass | "Save the match" saves the chosen artist. "Search MusicBrainz" shows the results. "Search again" starts the searches. "Change" opens the page for the name. "Open … on MusicBrainz" opens the artist (page tests). |
| CT-05 | Pass | British English. Countries as names, for example "United Kingdom". Years as numbers. The terms agree with the glossary: artist match, lineup name, expected genre, "no match". Artist names and genres come from MusicBrainz and are marked as external text. |
| CT-06 | Pass | Standards test. The hint "for example: metal, hard rock, metalcore" is an instruction, not example data. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 to IM-06 | Not applicable | No images, testimonials or statistics. The genres and the years come from MusicBrainz and show as facts of the artist. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | Page tests use each control. |
| IN-02 | Pass | Badges, warnings and matched rows have no pointer cursor and no hover change. The choice label and the summary of the closed group have a pointer cursor, because they are controls. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is still empty. The closed group is a native `details` element with no animation. |
| IN-05 | Not applicable | No counters, typing effects or transitions. |
| IN-06 | Pass | The search for one name is a GET request with an address. After a save, the application sends the browser to Admin: artist matches (status 303), so a refresh does not save again. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass, with an outstanding item | The workflow completes in the page tests with recorded MusicBrainz responses. The recorded responses come from the production MusicBrainz API on 18 November 2026. A match with `npm start` and the real API is an outstanding item. |
| FN-02 | Pass | The notice after a save reads the match from the database. A failed search shows a notice with the cause, not results (page test). |
| FN-03 | Pass | A save without a choice gives "Choose an artist or “No match”." with status 400 (page test). The form keeps the search text. |
| FN-04 | Pass | Loading: names that wait for the search, with the count and the rate. Empty: "MusicBrainz found no artist", and "Each lineup name has an artist match". Error: the search stopped, with the cause and "Search again". Success: the notice after a save. Permission-restricted: a user who is not the admin gets status 403 on the pages and the forms (page test). Unknown festival or name: Page not found. |
| FN-05 | Pass | The search finds known artists by name, by a different spelling ("BMTH") and by a MusicBrainz address. The proposal uses the name, the expected genres and the votes (module tests). |
| FN-06 | Pass | Matches and search results are in the database. A match applies to the same name on each festival (module and page tests). |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. Screenshots at 360, 768 and 1280 px. |
| QA-02 | Pass | Long disambiguations and genre lists wrap inside the choice (screenshots). The search gives a maximum of 5 artists for each name. |
| QA-03 | Pass | Page test: the admin saves a match with the keyboard only. The radio buttons, the summary and the buttons have a visible outline. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set. |
| QA-06 | Pass | The header is not fixed. No overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | Both artist match pages use one choice component, the same as the Clashfinder page choices. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | Each link goes to its destination. The MusicBrainz links go to `https://musicbrainz.org/artist/<MusicBrainz ID>`. |
| PB-04 | Pass | Standards test on each artist match state. |
| PB-05 | Pass | The artist match states are in the standards test and the axe scan. |
| PB-06 | Pass, with outstanding items | Release test record below. The outstanding items come from the previous record. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The search progress answers "how long?". The label of the search field names the MusicBrainz address, because the admin does not expect it in a search field. The "No match" hint gives the consequence. |
| CP-02 | Pass | Direct wording. |
| CP-03 | Pass | "Matched The Prodigy to The Prodigy" comes first, then the warning. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | No text explains that a match applies to all festivals. Page briefs give the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables in the design spec. |
| ED-04 | Pass | The request limit shows as the rate of the search. A 503 response shows as "MusicBrainz was busy" with an instruction to try again later. |
| ED-05 | Pass | The proposal has the chosen style and "Save the match" has the filled button. The other artists, the links and the matches are smaller or closed. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Pass | The genre warning for an artist with no genres was made shorter. It still says that there is nothing to compare. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| As the admin, add Download 2027. Manage festivals shows "10 lineup names have no artist match" and "Match the artists". | Pass |
| Open Admin: artist matches. The searches complete in the background. Each name shows its proposal, with the facts and the genres. | Pass |
| Save the proposal of Bring Me The Horizon with one action. The notice shows the match. The name moves to "Artist matches". | Pass |
| Save The Prodigy. The warning shows before and after the save. The match is first in "Artist matches". | Pass |
| "???" has the proposal "No match". Save it. | Pass |
| Change a match with the search text "BMTH". | Pass |
| Save without a choice. The problem shows. | Pass |
| Add a second festival with the same lineup. Bring Me The Horizon has its match. | Pass |
| MusicBrainz gives status 503. The searches stop, the cause shows, and "Search again" completes them. | Pass |
| Save a match with the keyboard only. | Pass |
| As a user who is not the admin, open the pages and send the forms. Each gives status 403. | Pass |
| Look at Admin: artist matches at 360, 768 and 1280 px, and on Pixel 7. Nothing overlaps or is cut off. | Pass |
| Send requests to the production MusicBrainz API for the genre list and 12 searches. | Pass. On 18 November 2026, with a pause of 2 seconds. The API gave status 503 to some requests before the retry. These responses are the recorded test responses. The User-Agent did not contain the contact of the admin. |
| Match artists with `npm start`, the real MusicBrainz API and `MUSICBRAINZ_CONTACT`. | Not done. Outstanding item. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Match artists with `npm start` and the real MusicBrainz API, with `MUSICBRAINZ_CONTACT` set.
- Perception check by a person.
- The audit has no approver, because this is not a release.
