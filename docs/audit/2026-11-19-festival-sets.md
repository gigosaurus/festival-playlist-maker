# Audit record: Festival sets and the tour limit

| Item | Value |
|---|---|
| Date | 19 November 2026 |
| Change | Predicted songs: festival sets and the tour limit (#13). A show is a festival set when MusicBrainz has a festival of the artist on the date, or when setlist.fm has 10 or more artists at the venue on the date. A festival set counts 2. All the other shows of one tour together count a maximum of 3 shows. The application stores the result for each venue and date. The time in the progress text on Admin: artist matches changed. |
| Pages in scope | Admin: artist matches, with artists that wait for the predicted songs (the progress text changed). No other page changed. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-19-predicted-songs.md](2026-11-19-predicted-songs.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the same 33 pages and page states as the previous record, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** All page tests pass with the new calculation. The recorded venue-and-date searches are in the test server. `test/e2e/admin-predicted-songs.spec.ts` covers a new match that gets predicted songs, the fallback for an artist with no recent setlists, a recalculation, and a failed calculation that the admin starts again. It includes axe WCAG 2.2 AA scans of four states. The tests replace the Spotify embed player with a fake page, because the test browser cannot open external pages. The page tests of the previous record also pass.
- **Module tests:** `test/modules/predicted-songs.test.ts` uses the recorded setlist.fm, MusicBrainz and Spotify responses (`test/fixtures/setlist-fm/`, `test/fixtures/musicbrainz/`, `test/fixtures/spotify/`). For #13, it covers the number of artists at a venue on a date, the MusicBrainz festival days, a MusicBrainz failure, the festival set threshold, the festival set weight, the tour limit, festival sets with a tour name, the stored venue-and-date results, a second check of a result from soon after the date, and the settings. It uses the recorded shows of Bring Me the Horizon, which have 16 festival sets (11 from MusicBrainz and 9 from setlist.fm) and a tour of 17 shows. It also covers the score, the weights, tape songs, the look-back period, the order, songs with no Spotify recording, the fallback for an artist with no setlists, the store contents, the 6-month valid period with the fake clock, a recalculation, setlist.fm and Spotify rate limits, a quota error and a background start. `test/modules/http-client.test.ts` covers the setlist.fm API key, the `Accept` header, the pause of 0.5 seconds, the limit of 1,440 requests in 24 hours and status 429.
- **Screenshots:** Admin: artist matches while 1 artist waits for the predicted songs, with the new progress text, at 1280 px and on Pixel 7. The text wraps, and nothing overlaps. No horizontal scrolling. The screenshots of the previous record are still correct for the other states.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of Predicted songs for one name shows the link back, the lineup name, the artists, the calculation time, the source, the action and the first songs. |
| IA-02 | Pass | Page-to-task map in the design spec. The new page supports user stories 66, 68 and 70. |
| IA-03 | Pass | Admin: artist matches shows the number of songs and the fallback. The new page shows the songs. Neither repeats the other. |
| IA-04 | Pass | Predicted songs for one name: the artists, the calculation and its source, the action, then the songs. |
| IA-05 | Pass | "Show the predicted songs" opens the page with the title "Predicted songs for {name}". |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The song list has only the stored songs: 10 for Bring Me the Horizon, 5 for the fallback example. No empty rows. |
| LY-02 | Pass | The songs are a numbered list, not a card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | The song list is the largest area. The action is a secondary button. The facts use the label and body styles. |
| LY-05 | Pass | One song is 88px high with its space, so a desktop screen shows the facts and 3 songs (screenshots). |
| LY-06 | Pass | The song numbers are the order of prediction. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | New type style: song number. The predicted songs line uses the matched artist style. The warnings use the genre warning style (type styles table). |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | The fallback warning and the "no songs" warning use the warning colour, as the other warnings do. The stopped calculation uses the notice with the problem colour. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each new page state. The Spotify player draws its own content, so axe does not measure it. |
| VS-06 | Pass | Standards test. Labels use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | No new borders. The Spotify player has no border. |
| DC-04 | Not applicable | No new badges. |
| DC-05 | Pass | No new icons. The Spotify player has its own controls. |
| DC-06 | Pass | The Spotify player has the panel radius, 12px, which agrees with the radius that Spotify draws. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | The fallback warning names the cause (no setlists in the last 18 months) and the consequence (the songs are not predicted). |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | The row warning and the summary line give the same fact at two levels: one artist, and the count. The count lets the admin find the artists without reading each row. |
| CT-04 | Pass | "Show the predicted songs" opens the page. "Calculate the predicted songs again" starts a calculation (page tests). |
| CT-05 | Pass | British English. Dates in the en-GB format. "Predicted songs" and "festival set" agree with the glossary. |
| CT-06 | Pass | Standards test. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 to IM-06 | Not applicable | No images, testimonials or statistics. Spotify draws the content of the player. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | Page tests use "Show the predicted songs", "Calculate the predicted songs again" on both pages, and "Show the new results". |
| IN-02 | Pass | The song numbers and rows have no pointer change. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is still empty. The Spotify player is a separate page in an iframe. |
| IN-05 | Pass | No counter effect. The page shows the stored result, or that the calculation waits. |
| IN-06 | Pass | The recalculation sends the browser to the page (status 303), so a refresh does not send the form again. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The workflow completes in the page tests against the test server with a real database and recorded responses. |
| FN-02 | Pass | The page shows a result only after the calculation saved it. After "Calculate the predicted songs again", it says that the calculation waits or runs, and it shows the old result until then. |
| FN-03 | Not applicable | No form fields. |
| FN-04 | Pass | Loading: "N artists wait for the predicted songs", with the time "approximately 10 seconds to 1 minute", because the first calculation of an artist with many shows checks approximately 45 venues and dates on setlist.fm. Then "The calculation waits or runs". Empty: the artist without a Spotify artist, and the result without tracks. Error: the stopped calculation with its cause (page test with status 403). Success: the songs. Unavailable: a rate limit gives the time at which the calculation continues (module tests). Permission-restricted: the admin area (previous record). |
| FN-05 | Not applicable | No search, filter, sort or pagination on the new page. |
| FN-06 | Pass | A result stays valid for 6 months, and the page shows the end date (module test with the fake clock). |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. The player fills the column width. |
| QA-02 | Pass | A long warning wraps. The players load only when they come into view. |
| QA-03 | Pass | Each link, button and player iframe is in the tab order with the focus indicator. On 19 November 2026, the change author used the real players with the keyboard only: the focus was visible, Enter and Space played each song, and Tab and Shift+Tab moved into and out of each player in order. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set. |
| QA-06 | Pass | No fixed elements or overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | The progress text, the stopped notice and the button agree with the MusicBrainz and Spotify artist states. The facts use the shared component. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | A lineup name without an artist match gives Page not found on the new address (`matchedLineupName`). |
| PB-04 | Pass | Standards test on each new page state. |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The progress text answers "how long?" with a time that agrees with the new calculation. The fallback warning answers "where is the playlist weaker?". "Valid until" answers "will this be calculated again before the festival?". The rate-limit text answers "why is it slow?". |
| CP-02 | Pass | Direct wording. |
| CP-03 | Not applicable | The recalculation completes in the background, so there is no confirmation. The page shows the state. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | No text explains the score, the festival sets or the tour limit. The page brief gives the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The Predicted songs for one name brief in the design spec. |
| ED-02 | Pass | Page brief: each explanation has its question. |
| ED-03 | Pass | Content table in the design spec. |
| ED-04 | Pass | The fallback warning gives the consequence ("not predicted"), not the method. |
| ED-05 | Pass | The song list fills the page. The button is secondary. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Save the match for Bring Me The Horizon while the calculation runs. The progress text says "approximately 10 seconds to 1 minute". The text wraps at 1280 px and on Pixel 7. | Pass |
| The calculation checks each venue and date in the look-back period once. A second calculation sends only the setlist page requests (module test and page test "the admin calculates the predicted songs of one artist again"). | Pass |
| Save the match for Bring Me The Horizon. The page opens at once. After a reload, the match shows "Predicted songs: 10 songs from setlists". | Pass |
| Open "Show the predicted songs". The page shows 10 numbered players in order, the calculation time, "Valid until 19 May 2027" and the source. | Pass |
| Match a name to the Japanese band "Ghost". The match shows the fallback warning with 5 songs, and the summary line counts 1 artist. Its page shows the fallback warning. | Pass |
| Select "Calculate the predicted songs again". The page opens again, and after a reload it shows a new calculation time. | Pass |
| Make setlist.fm refuse the API key. The page shows the stopped calculation with the cause. Correct the response, and select "Calculate the predicted songs again". The songs show. | Pass |
| Select "Calculate the predicted songs again" on the running application with the real services. The page shows the state "A new calculation waits or runs." The change author examined it on 19 November 2026. | Pass |
| Use the real Spotify players with the keyboard only. The focus is visible, each song plays, and the focus does not get stuck in a player. | Pass |
| Look at the new states at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass. The first screenshots showed narrow players with the numbers at the bottom, and a "Valid until" time that was one hour different from the calculation time because of British Summer Time. The players now fill the column, the numbers are centred, and "Valid until" gives only the date. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. The tests replace the Spotify player with a fake page. On 19 November 2026, the change author examined the real player on the running application, and it worked.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The application finds 16 of approximately 21 festival sets of Bring Me the Horizon. Aftershock, Welcome to Rockville, Sonic Temple, Copenhell and probably Sick New World are not on MusicBrainz, and setlist.fm has a venue for each of their stages. Smaller artists probably have fewer MusicBrainz events.
- The first calculation of a large lineup sends approximately 45 more setlist.fm requests for each artist with many shows, so it can need several days at 1,440 requests each day (ADR-0002).
- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
