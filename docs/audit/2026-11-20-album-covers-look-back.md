# Audit record: Album-focused shows, covers and the long look-back

| Item | Value |
|---|---|
| Date | 20 November 2026 |
| Change | Predicted songs: album-focused shows, covers and the longer look-back period (#14). An album-focused show counts 0.1. A cover is kept only when it is in the 10 songs with the highest score and Spotify has a recording of it by the performing artist. An artist with fewer than 5 shows in the last 18 months gets a look-back period of 3 years, then 5 years, and the long look-back mark. The fallback text now gives the longest period, 60 months. |
| Pages in scope | Admin: artist matches (a new row warning and a new summary line, and the fallback texts), and Predicted songs for one name (the "Source" fact). The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-19-festival-sets.md](2026-11-19-festival-sets.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the page states of the previous record and on 2 new states, "Artist matches, long look-back mark" and "Predicted songs for one name, long look-back mark", at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** All 638 page tests passed before the 2 new standards states were added. Then the 28 checks of the 2 new states passed. `test/e2e/admin-predicted-songs.spec.ts` has a new test: a match to Rage Against the Machine gets songs from setlists of the last 60 months, and the admin sees the row warning, the summary line and the "Source" warning. It includes axe WCAG 2.2 AA scans of both pages. The fallback test now expects "60 months".
- **Module tests:** 165 tests pass. `test/modules/predicted-songs.test.ts` uses recorded setlist.fm, MusicBrainz and Spotify responses for 3 new artists. Geese is on an album-focused tour (93 album-focused shows). Limp Bizkit has famous covers ("Behind Blue Eyes" is the 10th song, "Faith" the 11th). Rage Against the Machine has no shows after 2022. The tests cover the MusicBrainz albums (live and remix albums are not albums), the album-focused rule and its settings, the cover rule and its setting, the cover mark from setlist.fm, the Spotify recording of a cover, the look-back periods and their settings, the stored look-back period, the long look-back mark, and a MusicBrainz failure of the album request.
- **Screenshots:** Admin: artist matches with 3 matches (setlists, fallback, long look-back), and Predicted songs for one name with the long look-back mark and with the fallback, at 1280 px and on Pixel 7. The warnings wrap, and nothing overlaps. No horizontal scrolling.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

The results of the previous record stay correct, except for the rows below.

| ID | Result | Evidence |
|---|---|---|
| IA-02 | Pass | Page-to-task map: both pages now also support user story 67. |
| IA-03 | Pass | The row warning gives the mark for one artist. The summary line gives the count. Predicted songs for one name gives the period with the songs. |
| LY-04 | Pass | The new warnings use the genre warning style, the same as the other warnings about predicted songs. They do not compete with the song list or the principal action. |
| VS-04 | Pass | The long look-back warning uses the warning colour. A warning does not stop an action. |
| VS-05 | Pass | Standards test (axe colour contrast) on the 2 new states. |
| CT-01 | Pass | The long look-back warning names the cause (fewer than 5 shows in the last 18 months), the period that the songs come from, and the consequence (less reliable). |
| CT-03 | Pass | The row warning and the summary line give the same fact at two levels, as for the fallback. |
| CT-05 | Pass | "Look-back period" and "album-focused show" are in the glossary. Periods are in months, as before. |
| CT-06 | Pass | Standards test on the 2 new states. |
| FN-01 | Pass | The workflow with the long look-back completes in the page tests against the test server with a real database and recorded responses. |
| FN-04 | Pass | Error: a failed MusicBrainz album request stops the calculation with its cause (module test). The other states are unchanged. |
| FN-06 | Pass | The store keeps the look-back period of each result. Results from before the change get 18 months, the period that they used. |
| PB-01 | Pass | The new warnings use the same component and wording pattern as the fallback warnings. |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The long look-back warning answers "which predictions are less reliable?" (user story 67). |
| CP-07 | Pass | No text explains the album-focused rule or the cover rule. They change only the songs and their order. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The page briefs of both pages in the design spec name user story 67. |
| ED-02 | Pass | The design spec gives the question of each new text. |
| ED-03 | Pass | Content tables in the design spec, with the removed content (the album-focused shows, the removed covers and the scores). |
| ED-04 | Pass | The warnings give the consequence ("less reliable"), not the method. |
| ED-07 | Pass | The fallback texts keep their meaning. Only the period changed, because the application now looks back 60 months before it uses the fallback. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Match a name to Rage Against the Machine. The row shows "Warning: fewer than 5 shows in the last 18 months. 10 songs from setlists of the last 60 months." The summary line counts 1 artist. | Pass |
| Open "Show the predicted songs" for that match. The "Source" fact shows the 60 months and the warning. The page shows 10 songs. | Pass |
| Match a name to the Japanese band "Ghost". The row and the page show the fallback warning with 60 months. | Pass |
| Bring Me the Horizon gets the same 10 songs as before the change. Its 3 album-focused shows (the "Count Your Blessings \| Repented" tour) change only songs after the 10th. | Pass |
| Look at the new states at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. The tests replace the Spotify player with a fake page.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- #38: a MusicBrainz festival of several days makes each show of the artist in those days a festival set. The recorded shows of Rage Against the Machine show it.
- The album-focused rule compares song names with the track titles on MusicBrainz. A song with a different name on setlist.fm, for example a medley "I CARE / DULL", does not count for the album.
- The application does not calculate the existing results again. A stored result keeps its old order until it stops being valid or the admin calculates it again.
- The outstanding items from the previous record: the festival sets that neither source finds, the number of setlist.fm requests for a large lineup, the real Spotify log in as other users, the perception check, and an approver.
