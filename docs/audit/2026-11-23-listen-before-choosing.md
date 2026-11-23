# Audit record: Listen before choosing an interest level

| Item | Value |
|---|---|
| Date | 23 November 2026 |
| Change | #18. On the Festival page, each artist with predicted songs has "Play the songs". It opens the Spotify embed player under the artist, through the Spotify iFrame API, with "Previous song", "Next song" and the position. At the end of a song, the player plays the next song. Each artist with a Spotify artist has the link "Spotify". Each artist with songs from setlists has the link "setlist.fm", which is also the setlist.fm attribution. An artist with the Spotify search fallback shows that its songs come from a Spotify search. The application stores the address of the setlist.fm page of the artist with the predicted songs. Predicted songs for one name links "Setlists on setlist.fm" to the same page. |
| Pages in scope | Festival (`/festivals/{id}`): the listen line, the open player, the player when the Spotify iFrame API does not load, an artist with the fallback, the page without JavaScript. Predicted songs for one name: the Source fact. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-22-daily-lineup-check.md](2026-11-22-daily-lineup-check.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. The Festival page states of the previous record now include the listen line for each of 150 artists, because the large test lineup has Spotify artists, setlist.fm addresses and one fallback artist. At desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** 758 page tests and standards checks ran on the change. 756 passed. The 2 failures were one keyboard test at two sizes, which expected Tab to go from "Sort by" to the interest levels. The test now expects the player button and the two links first, and passes. The affected specs then passed again (332 tests). `test/e2e/listen.spec.ts` has 9 new tests at two sizes: the links and their addresses, no nofollow, the fallback text, an artist without songs, play in order and one player at a time, the next song at the end of a song, keyboard use and no overlap at 320 px with an axe WCAG 2.2 AA scan, the player and the search, the failed iFrame API, and the page without JavaScript. The fixtures have a fake of the Spotify iFrame API.
- **Module tests:** 181 tests pass. New: setlist.fm gives the address of the artist page, and refuses an address that is not on www.setlist.fm. The playlist artists have the songs, the fallback mark, the setlist.fm address and the Spotify artist. The store test now includes the address column.
- **Screenshots:** the Festival page with the listen line, with the player open, and with the fallback artist. At 1280 px and on Pixel 7. No horizontal scrolling.
- **Design decisions:** [docs/design-spec.md](../design-spec.md). ADR-0002 records the stored address.

## Website acceptance criteria

The results of the previous record stay correct, except for the rows below.

| ID | Result | Evidence |
|---|---|---|
| IA-02 | Pass | Page-to-task map: the Festival page now also supports user stories 18 and 41. |
| IA-03 | Pass | The player shows the song name, so the page has no song list. The position "Song 2 of 10" is the only count. |
| IA-04 | Pass | The listen line is under the genres, before the interest levels in the reading order, because the user listens before the choice. |
| LY-04 | Pass | The listen button is smaller than the secondary button, and the links use the genre size. The interest levels keep the most emphasis in the row. |
| VS-02 | Pass | New type styles: listen links and song position. |
| VS-04 | Pass | The links and the buttons use the link colour. The open state uses the selected background, as the chosen interest level does. |
| VS-05 | Pass | Standards test (axe colour contrast) on the Festival page states, and the axe scan with the player open. The disabled song button uses muted text on surface (7.10:1). |
| DC-06 | Pass | New component roles: listen line, listen button, artist player, song button. The Spotify player keeps its role. |
| CT-04 | Pass | "Play the songs" opens the player and plays. "Close the player" closes it. "Spotify" and "setlist.fm" name their destinations. The accessible names add the artist. |
| CT-05 | Pass | "Predicted songs", "Spotify artist" and "Interest level" agree with the glossary. |
| IN-01 | Pass | Page tests use each new control and check the result. |
| IN-06 | Pass | The links open in the same tab, as the other links on the page do. |
| FN-04 | Pass | Error: "The Spotify player did not load. Try again later.", with the song buttons disabled. A second attempt loads the API again (page test). Unavailable: an artist without predicted songs has no player button. |
| QA-01 | Pass | The listen line wraps on Pixel 7. The player is the full column width up to 32rem (screenshots). |
| QA-03 | Pass | The listen button, the links and the song buttons are native controls with the focus indicator. A page test opens the player and changes the song with the keyboard only. The content of the player is the keyboard interface of Spotify. |
| QA-06 | Pass | The player is part of the artist row, not an overlay. A page test at 320 px checks that it ends above the interest levels, and the row ends above the next row. |
| PB-01 | Pass | The Spotify player is the same embed as on Predicted songs for one name. The buttons follow the secondary button style. |
| PB-03 | Pass | The Spotify link goes to the artist page of the stored Spotify artist. The setlist.fm link uses the address that setlist.fm gives for the artist, only on www.setlist.fm (module test). |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | "The songs come from a Spotify search, not from setlists." prevents the error "the artist plays these songs live". |
| CP-07 | Pass | The page does not explain previews and full songs, because Spotify shows this in the player. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The page brief of the Festival page in the design spec. |
| ED-02 | Pass | The design spec gives the question of the fallback text. |
| ED-03 | Pass | The content table in the design spec, with the removed content (song names as text, the look-back period). |
| ED-04 | Pass | The fallback gives its consequence: the songs are not from setlists. The iFrame API and the stored address show only as the player and the link. |
| ED-05 | Pass | The interest levels stay the principal task of each row. "Make the playlist" stays the principal action. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Open the Festival page. No request goes to Spotify. Each artist with songs has "Play the songs", "Spotify" and "setlist.fm", on one line at 1280 px. | Pass |
| Select "Play the songs" for Ghost. The player shows song 1 of 10 and gets "play". Select "Next song", then "Previous song". The player shows the song. | Pass |
| Select "Play the songs" for a second artist. The first player closes. Only one player shows. | Pass |
| Send the end of a song to the fake API. The player plays song 2. | Pass |
| Search for a name that hides the artist. The player closes. | Pass |
| Make the API request fail. The problem text shows, and the song buttons are disabled. A second attempt opens the player. | Pass |
| Look at the fallback artist. It shows the fallback text and no setlist.fm link. | Pass |
| Look at each state at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. The Spotify iFrame API and the embed player page were fakes, made from the published API script (methods `createController`, `loadUri`, `play`, `destroy`, `addListener`, event `playback_update`).

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The real Spotify embed player was not tested. The automatic next song depends on the `playback_update` events of the real player at the end of a song. Check it with the real player before the first release.
- Predicted songs from before this change have no setlist.fm address. Those artists have no setlist.fm link until the next calculation.
- Each artist row has 3 more Tab stops before its interest levels. A keyboard user can use the search to go to an artist.
- The outstanding items from the previous record.
