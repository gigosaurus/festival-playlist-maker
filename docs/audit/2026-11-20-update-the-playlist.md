# Audit record: Update the playlist and show changes

| Item | Value |
|---|---|
| Date | 20 November 2026 |
| Change | #16. After each complete update, the application keeps the lineup of the update and the number of songs of each artist. The next update compares with it. The confirmation after an update gives the added and removed artists. A removed artist that is not on the lineup now shows "(not on the lineup)". Artists that are on the lineup now but were not at the last complete update have the badge "New". The Playlist panel gives their number, and the filter "Only new artists" finds them. |
| Pages in scope | Festival (`/festivals/{id}`): new artists after a lineup change, the filter "Only new artists", the confirmation after an update with changes and without changes. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-20-make-the-playlist.md](2026-11-20-make-the-playlist.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the page states of the previous record and on 2 new states, "Festival page, new artists after a lineup change" and "Festival page, playlist updated with changes", at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** 740 page tests and standards checks passed. `test/e2e/playlist.spec.ts` has 2 new tests. The first one makes the playlist, changes the lineup (one artist cancelled, two added), and checks that Spotify got no request. It then checks the "New" badges, the panel text, the filter and the address, sets levels, updates, and checks the added and removed artists, the requests to the same playlist and the songs. It includes 2 axe WCAG 2.2 AA scans. The second test checks an update without changes to the artists. The test server has a new control route that gives a festival a new lineup.
- **Module tests:** 179 tests pass. `test/modules/playlists.test.ts` has 3 new tests: a later update after a lineup change with added and removed artists (user stories 27 to 30 and 53), an update without changes to the artists, and an update that fails and keeps the lineup of the last complete update. The test of a later update now also checks the changes.
- **Screenshots:** the Festival page with new artists, with the filter "Only new artists" and a long artist name, and after an update with 2 added and 5 removed artists. At 1280 px and on Pixel 7. No horizontal scrolling.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

The results of the previous record stay correct, except for the rows below.

| ID | Result | Evidence |
|---|---|---|
| IA-02 | Pass | Page-to-task map: the Festival page now also supports user stories 21, 27 to 31 and 53. |
| IA-03 | Pass | The headings "Added N artists" and "Removed N artists" give the number, so the lists have no separate count. The panel gives the number of new artists. The filter label does not repeat it. |
| IA-04 | Pass | The number of new artists is in the Playlist panel, before "Update the playlist", because the user sets their levels before the update. |
| LY-01 | Pass | The lists, the panel text, the badges and the filter show only when they have content. |
| LY-04 | Pass | The change headings are smaller than the notice heading. The badge "New" uses the existing badge style, with less emphasis than the artist name. |
| VS-02 | Pass | New type style: change heading. The panel text about new artists uses the playlist count style. "(not on the lineup)" is supporting text. |
| VS-04 | Pass | The confirmation keeps the success strip. The checkbox uses the link colour, as the chosen interest level does. |
| VS-05 | Pass | Standards test (axe colour contrast) on the 2 new states, and axe scans in the page tests. |
| DC-04 | Pass | The badge "New" gives a specific state for the user: the artist was not on the lineup at the last update. |
| DC-06 | Pass | The change lists have no panel, because they are in the notice. The badge and the checkbox follow their component roles. |
| CT-01 | Pass | The removed artists give the cause "(not on the lineup)" only when the user did not cause the removal. |
| CT-04 | Pass | "Update the playlist" replaces the items of the same playlist (module and page tests). "Only new artists" shows only the new artists. |
| CT-05 | Pass | "Lineup", "Playlist" and "Interest level" agree with the glossary. |
| IN-01 | Pass | Page tests use the checkbox and the update action. |
| IN-06 | Pass | The address keeps the filter "Only new artists" (`new=1`), so a reload and Back show the same list (page test). |
| FN-02 | Pass | The changes show only after the redirect from a complete update. An update that fails keeps the lineup and the changes of the last complete update (module test). |
| FN-04 | Pass | Empty: a search or a level filter with "Only new artists" and no result names the conditions and gives "Show all artists". Success: the notice with the lists, or "No artist was added or removed.". The error states are the same as in the previous record. |
| FN-06 | Pass | The lineup of the last complete update is in the database. An artist stays new after a reload until the next complete update. |
| QA-01 | Pass | The lists, the badge and the checkbox wrap on Pixel 7 (screenshots). A long artist name puts the badge on the next line. |
| QA-03 | Pass | The checkbox is a native control with the focus indicator. |
| PB-01 | Pass | The notice, the badge and the lineup tools use the existing components. |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | "(not on the lineup)" answers "why did this artist go?". The panel text about new artists tells the user that levels need attention before the update. |
| CP-03 | Pass | "Updated the playlist Download 2027 in Spotify" comes before the lists. |
| CP-07 | Pass | The page does not explain that the update keeps the same playlist, because this is the usual behaviour of an update. The song changes of each artist are not shown, because the user made them. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The page brief of the Festival page in the design spec. |
| ED-02 | Pass | The design spec gives the question of each new text. |
| ED-03 | Pass | The content table in the design spec, with the removed content (the song changes of each artist). |
| ED-04 | Pass | The comparison with the stored lineup shows only as its result: the lists and the "New" badges. |
| ED-05 | Pass | "Update the playlist" stays the principal action of the panel. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Make the playlist. The confirmation has no list. No artist shows "New", and the filter "Only new artists" does not show. | Pass |
| Give the festival a new lineup without Ghost and with two new artists. Spotify gets no request. Open the Festival page. The panel shows "2 artists are new on the lineup since your last update.", and the two artists show "New". | Pass |
| Select "Only new artists". The list shows "2 of 151 artists", and the address contains `new=1`. | Pass |
| Set one new artist and Black Choir to Not interested. Select "Update the playlist". The notice shows "Added 1 artist" with the other new artist, and "Removed 2 artists" with "Black Choir" and "Ghost (not on the lineup)". No artist shows "New". Spotify got the items of the same playlist, without Ghost. | Pass |
| Change one level from Curious to Must see and update. The notice shows "No artist was added or removed." | Pass |
| Look at each state at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. The Spotify API was a fake with responses from the Spotify Web API reference.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- A playlist that the application made before this change has no stored lineup. Its next update shows "Updated …" without lists, and no artist shows "New" until that update is complete.
- A playlist that the user deleted in Spotify gives a refused update. The application does not make a new playlist.
- The outstanding items from the previous record, except #16.
