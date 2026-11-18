# Audit record: Spotify artists

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Spotify artist for each artist match (#8): the MusicBrainz Spotify link or a Spotify search, in the background; the Spotify artist on Admin: artist matches; Spotify artist for one name, where the admin sets it by hand; Spotify pacing, Retry-After and the quota error in the HTTP client |
| Pages in scope | Admin: artist matches (`/admin/festivals/{id}/artist-matches`): Spotify artists wait, Spotify artists found, no Spotify artist found, Spotify search stopped, after a Spotify artist set by hand. Spotify artist for one name (`/admin/festivals/{id}/artist-matches/{lineup name id}/spotify`): current artist, problem. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-artist-matches.md](2026-11-18-artist-matches.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on 22 pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/admin-artist-matches.spec.ts` ("Spotify artist" tests), and the page tests of the previous record. They include an axe WCAG 2.2 AA scan of Admin: artist matches with Spotify artists and of Spotify artist for one name with and without a problem. The tests use recorded Clashfinder, MusicBrainz and Spotify responses through the fake HTTP client.
- **Module tests:** `test/modules/spotify.test.ts` (access token from the refresh token of the admin, new refresh token, status 401, search, address formats), `test/modules/spotify-artists.test.ts` (MusicBrainz link, search, not found, set by hand, queue failure, quota error), `test/modules/http-client.test.ts` (Spotify pacing, Retry-After, long wait, quota error), and the earlier module tests.
- **Screenshots:** Admin: artist matches (Spotify search stopped with a quota error, Spotify artists found, after a Spotify artist set by hand) and Spotify artist for one name (current artist, problem) at 1280 px and on Pixel 7. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of Admin: artist matches shows the title with the festival, the expected genres and the first name with its proposal. The admin enters from "Match the artists". |
| IA-02 | Pass | Page-to-task map in the design spec. |
| IA-03 | Pass | A name is in one section only: without a match, or in "Artist matches". The notice after a save does not repeat the facts of the artist. The Spotify artist shows only in the match row, and on Spotify artist for one name as the current value. |
| IA-04 | Pass | Admin: artist matches: result of the last save, expected genres, names without a match (the principal task), then the matches. Each name: the proposal, "No match", the other artists, then "Save the match". |
| IA-05 | Pass | "Match the artists" opens "Artist matches for Download 2027". "Change" and "Search with a different text" open "Artist match for {name}". "Set the Spotify artist" opens "Spotify artist for {name}". The back links have the title of their destination. |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The pages show only the search results. The search gives a maximum of 5 artists. |
| LY-02 | Pass | Artist choices: separate MusicBrainz artists that the admin compares and selects. The matches are a list with dividers, not a card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | "Save the match" and "Save the Spotify artist" are the filled buttons. "Search MusicBrainz", "Search again" and "Find the Spotify artists again" have only a border. The proposal has the chosen style. The Spotify artist line is muted, below the artist. |
| LY-05 | Pass | When an artist is chosen, the other artists are in a closed group. This made the page with 10 names half as long (screenshots before and after). |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | The Spotify artist line uses the matched artist style, and the missing Spotify artist uses the genre warning style (type styles table). They agree with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | Colour roles in the design spec. The warning colour is for genre warnings, the Spotify artist warning and the warning notice strip. Problem stays for problems that stop an action. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each artist match state and on Spotify artist for one name. Warning text ratios (5.39:1 or more) are in the design spec. |
| VS-06 | Pass | Standards test. Labels and badges use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | The warning strip shows a completed action to check. A rule line separates the lineup names, because the choices in them have panels. Component roles table in the design spec. |
| DC-04 | Pass | The badges "Proposed" and "Current match" give the state of a choice. No new badges: the source of a Spotify artist is text. |
| DC-05 | Pass | No new icons. |
| DC-06 | Pass | Component roles table: panels 12px, controls 8px, badges 4px. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | Each text is specific: the source of each Spotify artist, the rate of the Spotify search, the consequence of a missing Spotify artist for playlists, the Spotify share action in the hint. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | A choice with no genres shows one warning line, not a genre line and a warning that repeat it. |
| CT-04 | Pass | "Save the match" saves the chosen artist. "Set the Spotify artist" opens the page for the name. "Save the Spotify artist" saves it. "Find the Spotify artists again" starts the search. The Spotify artist name opens the artist in Spotify (page tests). |
| CT-05 | Pass | British English. The terms agree with the glossary: artist match, lineup name, Spotify artist (new term). Spotify artist names come from Spotify and are marked as external text. |
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
| IN-06 | Pass | Spotify artist for one name has its own address. After a save, the application sends the browser to Admin: artist matches (status 303), so a refresh does not save again. The Spotify links open in a new tab. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The workflow completes in the page tests with responses recorded from the production MusicBrainz and Spotify APIs, and with `npm start` against the production APIs (release test record below). |
| FN-02 | Pass | The notice after a save of a Spotify artist reads it from the database. The application saves a Spotify artist only after Spotify gave it. A failed search shows a notice with the cause (page test). |
| FN-03 | Pass | An address that is not a Spotify artist, and an artist that Spotify does not have, give a problem with status 400 (page tests). The field keeps the text. |
| FN-04 | Pass | Loading: artists that wait for the Spotify artist, with the count and the rate. Empty: "Warning: no Spotify artist found". Error: the Spotify search stopped, with the cause (for example the quota error) and "Find the Spotify artists again". Success: the notice after a save. Permission-restricted: a user who is not the admin gets status 403 on the new page and forms (page test). Unknown name or a name with "no match": Page not found. |
| FN-05 | Pass | The Spotify search takes the first result with the same name or alias. Without one, the result is "not found" (module tests with recorded searches). |
| FN-06 | Pass | The Spotify artists are in the database, for each MusicBrainz artist. A Spotify artist set by hand stays after a new save of the match (module and page tests). |

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
| PB-01 | Pass | The Spotify artist line has one component on both pages. Spotify artist for one name uses the facts, field and notice components of the other pages. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | Each link goes to its destination. The Spotify links go to `https://open.spotify.com/artist/<Spotify ID>` (page test). |
| PB-04 | Pass | Standards test on each artist match state. |
| PB-05 | Pass | The artist match states are in the standards test and the axe scan. |
| PB-06 | Pass, with outstanding items | Release test record below. The outstanding items come from the previous record. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The Spotify progress answers "how long?". The source answers "must I check this artist?". The hint of the address field tells how to copy the address, because the Spotify apps do not show it. |
| CP-02 | Pass | Direct wording. |
| CP-03 | Pass | "Set the Spotify artist of Turnstile to Ghost" states the completed action. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | No text explains that a Spotify artist set by hand stays. The row shows "set by hand". Page briefs give the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables in the design spec. |
| ED-04 | Pass | A missing Spotify artist shows its consequence: playlists get no songs for the artist. A quota error and a rate limit show the cause and when to try again. |
| ED-05 | Pass | The proposal has the chosen style and "Save the match" has the filled button. The other artists, the links and the matches are smaller or closed. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| As the admin, save the match of Bring Me The Horizon. The Spotify artist shows with "from the MusicBrainz link", and its link opens `https://open.spotify.com/artist/1Ffb6ejR6Fe5IamqA5oRUF`. | Pass |
| Change the match to "Bring Me the Horizon UK". The warning "no Spotify artist found" shows. | Pass |
| Set the Spotify artist of Turnstile by hand. An album address gives a problem. An artist address saves, and the row shows "set by hand". A new save of the match does not replace it. | Pass |
| Enter an artist that Spotify does not have. The problem shows, and the field keeps the text. | Pass |
| Spotify gives a quota error. The search stops, the cause shows, and "Find the Spotify artists again" completes it. | Pass |
| As a user who is not the admin, send the new forms. Each gives status 403. | Pass |
| Look at the new states at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass. The first screenshot showed the current Spotify artist in a smaller, muted style than the other fact. It now has the style of the other facts. |
| Send requests to the production MusicBrainz API for 12 artist lookups with links, and to the production Spotify API for 10 artists and 2 searches. | Pass. On 18 November 2026, with a pause of 2 seconds. MusicBrainz gave status 503 to some requests before a new attempt. These responses are the recorded test responses. The Spotify requests used the access token of the admin. |
| Find the Spotify artists with `npm start` and the production APIs. | Pass. The project owner opened Admin: artist matches on 18 November 2026 and reported that the workflow works. The database has 9 Spotify artists for the 9 matches to an artist, all from the MusicBrainz link, found from 19:00:25 to 19:00:39 (UTC). |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
