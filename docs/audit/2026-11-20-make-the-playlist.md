# Audit record: Make the playlist

| Item | Value |
|---|---|
| Date | 20 November 2026 |
| Change | The playlist builder (#15). One action on the Festival page makes a private Spotify playlist "{festival} {year}" in the account of the user. The songs come from the interest levels and the stored predicted songs: Not interested 0, Curious 2, Keen 4 and Must see 7, in the order Must see, Keen, Curious, then artist name, then prediction order. The Festival page shows the number of songs and artists before the action, and the link and the last update after it. The Festivals page marks each festival with a playlist of the user. |
| Pages in scope | Festival (`/festivals/{id}`): the Playlist panel before and after the playlist, the success notice, a rate limit, a refused update, a playlist without all of the songs, a playlist without songs, without JavaScript. Festivals (`/`): a festival with a playlist. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-20-album-covers-look-back.md](2026-11-20-album-covers-look-back.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the page states of the previous record and on 2 new states, "Festival page, playlist made" and "Festivals page, a festival with a playlist", at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** 708 page tests and standards checks passed. `test/e2e/playlist.spec.ts` is new. It covers the count before the action and after level changes, the made playlist with its requests and the order of the first songs, the link and the last update, the Festivals page badge, a Spotify rate limit, a refused update, a playlist that does not have all of the songs, a playlist without songs and a browser without JavaScript. It includes axe WCAG 2.2 AA scans of three states. The Festival page tests now expect the number of songs.
- **Module tests:** 176 tests pass. `test/modules/playlists.test.ts` is new. It covers the song counts, an artist with fewer predicted songs, the order, the first update (a private playlist in the account of the user, with the access token of the user), more than 100 songs, a later update of the same playlist, a rate limit before and after some of the songs, a refused request, a quota error, a playlist without songs, and a second build at the same time. No test sends a setlist.fm request. The Spotify playlist responses have the shapes of the Spotify Web API reference, because a recording makes a playlist in a real account (`test/fixtures/spotify/README.md`).
- **Screenshots:** the Festival page before the playlist, after a rate limit, with a playlist that does not have all of the songs, and after an update; an artist without predicted songs; the Festivals page with the badge. At 1280 px and on Pixel 7. No horizontal scrolling.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

The results of the previous record stay correct, except for the rows below.

| ID | Result | Evidence |
|---|---|---|
| IA-02 | Pass | Page-to-task map: the Festival page now supports user stories 20, 22 to 26, 32 to 34. The Festivals page supports user story 8. |
| IA-03 | Pass | The success notice does not repeat the count in the panel. The panel warning about missing songs does not show when the notice above says it. |
| IA-04 | Pass | The Playlist panel is above the lineup, because a user who comes back updates the playlist. The count comes before the action. |
| LY-01 | Pass | The panel shows the link and the last update only when they exist. |
| LY-04 | Pass | The principal action button in the panel is the only filled button on the page. The link to the playlist has weight 650. The last update is supporting text. |
| LY-05 | Pass | The panel is approximately 170px high before the playlist (screenshots), so the first artists stay in the first viewport at 1280 px. |
| VS-02 | Pass | New type style: playlist link. The supporting text now includes the last update. |
| VS-04 | Pass | The incomplete-playlist warning uses the warning colour. The problem notices use the problem strip. The success notice uses the success strip. |
| VS-05 | Pass | Standards test (axe colour contrast) on the 2 new states, and axe scans of the failure states. |
| DC-03 | Pass | The panel border groups the playlist content. Component roles table in the design spec. |
| DC-04 | Pass | The badge "Your playlist is made" gives a specific state for the user. |
| DC-06 | Pass | The Playlist panel has the panel radius, 12px, and no shadow. |
| CT-01 | Pass | The failure notices give the cause from Spotify and the wait or "Try again later.". "No predicted songs" names why the count does not include an artist. |
| CT-04 | Pass | "Make the playlist" makes the playlist. "Update the playlist" sets the songs of the same playlist. "Open Download 2027 in Spotify" opens the playlist page (page tests). |
| CT-05 | Pass | "Playlist", "Interest level" and "Predicted songs" agree with the glossary. Dates and times use the date and time format of the other pages. |
| IN-01 | Pass | Page tests use each new control. |
| IN-05 | Pass | The count changes after the save, with no counter effect. The button label changes during the request, and the browser shows its loading state. |
| IN-06 | Pass | After a success, the browser goes to the Festival page (status 303), so a refresh does not send the request again. After a failure, the response is the Festival page with the notice. A refresh asks the browser to send the request again, which is correct, because the request did not complete. |
| FN-01 | Pass | The workflow completes in the page tests against the test server with a real database and Spotify responses with the shapes of the Spotify Web API reference. The real Spotify API is not tested (outstanding item). |
| FN-02 | Pass | The success notice shows only after the redirect from a complete build, and only when the stored playlist is complete. A rate limit, a refused request and a stop after some of the songs show a problem notice and no confirmation (page tests). |
| FN-04 | Pass | Loading: the disabled button with "Making the playlist…". Empty: "The playlist would contain no songs". Error: the three failure notices. Success: the notice, the link and the last update. Unavailable: a second request while the first one runs. Permission-restricted: a festival that is not published gives Page not found for the action too. |
| FN-06 | Pass | The playlist of each user and festival is in the database. The link and the last update stay after a reload. A different user has a different playlist. |
| QA-01 | Pass | The panel and the badge wrap on Pixel 7 (screenshots). |
| QA-03 | Pass | The button and the link are native controls with the focus indicator. |
| PB-01 | Pass | The notices and the badge use the existing components. |
| PB-05 | Pass | The new states are in the standards test and the axe scans. |
| PB-06 | Pass, with outstanding items | Release test record below. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | "No predicted songs" answers "which artist does the count not include?". The incomplete-playlist warning gives the correction. |
| CP-03 | Pass | "Made the playlist Download 2027 in Spotify" states the completed action. |
| CP-07 | Pass | The page does not explain the song counts of the levels or the order. The count shows the result of each change. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | The page briefs of the Festival page and the Festivals page in the design spec. |
| ED-02 | Pass | The design spec gives the question of each new text. |
| ED-03 | Pass | Content tables in the design spec, with the removed content (the song count of each level, the song list, the description). |
| ED-04 | Pass | The failure notices give the result for the playlist and the next action, then the cause. |
| ED-05 | Pass | The principal action of the panel has the principal action button. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Open the Festival page of a festival with 150 artists. The panel shows "The playlist will contain 284 songs by 149 of 150 artists." and "Make the playlist". The artist without predicted songs shows "No predicted songs". | Pass |
| Set Ghost to Must see. The count changes to 289 songs. | Pass |
| Select "Make the playlist". The page shows "Made the playlist Download 2027 in Spotify", the link, the last update and "Update the playlist". Spotify got a private playlist "Download 2027" and the songs in the required order, in requests of 100 songs. | Pass |
| Open the Festivals page. Download 2027 shows "Your playlist is made". | Pass |
| Make Spotify limit the request. The page shows "The application did not make the playlist" with the wait, and no link. The Festivals page shows no badge. | Pass |
| Make Spotify refuse an update. The page shows "The playlist did not change" and the old last update. | Pass |
| Make Spotify stop after the first 100 songs. The page shows that the playlist does not have all of the songs. After a reload, the panel shows the warning. The next update completes on the same playlist. | Pass |
| Look at each state at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. The Spotify API was a fake with responses from the Spotify Web API reference.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- Make a playlist with the real Spotify API, as a user who is not the admin, before the first release. The tests use responses from the Spotify Web API reference, not recordings.
- #16: the changes after an update (added and removed artists), and the "new" mark for artists added after the last update. The update action in this change replaces the songs, but it does not show the changes.
- A playlist that the user deleted in Spotify gives a refused update. The application does not make a new playlist.
- The outstanding items from the previous record.
