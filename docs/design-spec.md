# Design specification

This file records the design decisions for Festival Playlist Maker. Some audit criteria in `STANDARDS.md` use these decisions as evidence. Update this file when you change a page, a type style, a colour role, a component role or an animation.

The styles are in `src/public/styles.css`. The CSS custom properties in that file have the same names as the roles in this file.

## Page-to-task map (IA-02)

| Page | Address | Principal task | Who | Status |
|---|---|---|---|---|
| Log in | `/log-in` | Log in with Spotify | A person who is not logged in | Done (#4) |
| Festivals | `/` | Choose a published festival | User | Done (#9, #15) |
| Festival | `/festivals/{id}` | Set interest levels for the lineup, then make or update the playlist | User | Interest levels done (#10). Make the playlist done (#15). Update the playlist and show the changes done (#16). Listen before choosing a level done (#18). |
| Manage festivals (Admin: festival list) | `/admin/festivals` | See each festival and the state of its lineup, see the new names of the last lineup change, get a lineup again, and publish a festival | Admin | Done (#6, #9, #17) |
| Change the lineup source | `/admin/festivals/{id}/lineup-source` | Choose a different Clashfinder page for the lineup of a festival | Admin | Done (#17) |
| Add a festival | `/admin/festivals/new` | Add a festival and choose its lineup source | Admin | Done (#6) |
| Admin: artist matches | `/admin/festivals/{id}/artist-matches` | Match each new lineup name, and check genre warnings, Spotify artists and predicted songs | Admin | Done (#7, #8, #12, #14, #17) |
| Artist match for one name | `/admin/festivals/{id}/artist-matches/{lineup name id}` | Search MusicBrainz with a different text, or change a match | Admin | Done (#7) |
| Spotify artist for one name | `/admin/festivals/{id}/artist-matches/{lineup name id}/spotify` | Set the Spotify artist of a match by hand | Admin | Done (#8) |
| Predicted songs for one name | `/admin/festivals/{id}/artist-matches/{lineup name id}/predicted-songs` | Check the predicted songs of a match, and calculate them again | Admin | Done (#12, #14) |
| Page not found | Each unknown address | Find the correct page | User, admin | Done (#3) |
| Only the admin can open this page | Each address in `/admin/` | Go back to a page that the user can open | User who is not the admin | Done (#4) |

Each page except Log in needs a logged-in user. A person who is not logged in goes to the Log in page. After the log in, the page that the person first opened opens. This is the permission-restricted state for a person who is not logged in (FN-04).

## Page briefs (ED-01, ED-03)

### Log in

- **Principal task:** log in with Spotify.
- **Who and from where:** a friend of the admin who opens a link from the admin for the first time, or a user whose session ended. A user who logged out also comes here. The person knows Spotify. The first time, the person probably does not know what the application does.
- **Necessary before the task:** what the application does (first visit only), and the log in action.
- **Supporting detail:** none.

The page has four states: no problem, not on the allowlist, cancelled and failed. A problem state replaces the description with a notice, because a person in a problem state already started a log in and knows the application.

- **Not on the allowlist.** Spotify Development Mode lets the person log in at Spotify, then refuses each request (ADR-0001). The person asks "why can I not log in?" and "whom do I ask?". The notice gives the cause and tells the person to ask the admin. The admin needs the name and the email address of the Spotify account to add it to the allowlist in the Spotify Developer Dashboard, so the notice tells the person to give them (CP-01, prevents a probable error).
- **Cancelled.** The person selected Cancel at Spotify. The person can ask "what now?". The notice tells the person to log in again and accept the request.
- **Failed.** Spotify refused a request, the network failed, or the log in took more than 10 minutes. The person asks "is it my mistake?". The notice says that the application did not get the account, and tells the person to log in again and then to tell the admin.

| Content | Decision | Reason |
|---|---|---|
| Wordmark | Keep visible | Same shared header as on all pages (PB-01). There is no account area, because no user is logged in. |
| Page title "Log in" | Keep visible | States the task. |
| "The application makes a Spotify playlist from the lineup of a festival." | Keep visible, no-problem state only | Orientation for a person who opens the link for the first time (IA-01). |
| Button "Log in with Spotify" | Keep visible | The principal action. It names the service that opens next (CT-04). |
| Problem notice | Keep visible, problem states only | Gives the cause and the next action. |
| Text about the Spotify permission (private playlists) | Remove | The Spotify page shows the permission. Nothing on this page gives a reason to ask (CP-07). |
| Text that says the session stays after the browser closes | Remove | Usual behaviour for a log in (CP-07). |
| Contact details of the admin | Remove | Users know the admin personally. |

### Only the admin can open this page

- **Principal task:** understand that the page is not available, and go to a page that the user can open.
- **Who and from where:** a user who is not the admin and who opens an address in `/admin/`, for example from a link that the admin shared.
- **Necessary before the task:** the page is for the admin only, and a link to the Festivals page.

| Content | Decision | Reason |
|---|---|---|
| Page title "Only the admin can open this page" | Keep visible | States the cause. |
| "Your Spotify account does not have the admin role." | Keep visible | Tells the user that the cause is the account, not an error in the page. |
| Link "Show the festivals" | Keep visible | The principal page of the application (CT-04). |
| How to get the admin role | Remove | Only the account that owns the Spotify developer app is the admin. A user cannot get the role. |

### Festivals

- **Principal task:** choose a published festival.
- **Who and from where:** a user on the allowlist. In version 1, the user comes from the Spotify log in, from a bookmark or from the wordmark on a different page. The user knows the application and the festival that they go to.
- **Necessary before the task:** the published festivals, with the year and the dates of each one (user story 7).
- **Supporting detail:** the mark "Your playlist is made" on each festival for which the user has a playlist (user story 8). The user goes back to a festival to update the playlist.

The festivals that are still to come show first, the next festival first. A festival is still to come on its last day. The complete festivals show below them, in the section "Complete festivals", the most recent festival first (user story 10). The section heading tells the user why the order changes. A festival is complete after midnight in the United Kingdom, because the users and the festivals are in the United Kingdom.

Each festival is one panel that is one link. The full panel opens the Festival page, because the user selects a festival from the list (LY-02). The festival name has the link colour, so that the panel reads as a link before the pointer is on it.

A festival that is not published does not show, and its Festival page address gives Page not found (user story 9).

Empty state: no festival is published. The user cannot do the principal task. The user can ask "is the page broken, or is there nothing yet?" and "what do I do now?". The text answers both questions: there are no published festivals, and a festival shows when the admin publishes it. The user knows the admin, so the text does not give contact details.

| Content | Decision | Reason |
|---|---|---|
| Wordmark (application name, link to `/`) | Keep visible | Identifies the application and gives a fixed way back (IA-01, PB-04). |
| Page title "Festivals" | Keep visible | Agrees with the page name in the navigation and the browser title (IA-05). |
| Empty-state heading "There are no published festivals" | Keep visible | States the cause of the empty page. |
| "A festival shows here when the admin publishes it." | Keep visible | Tells the user what changes the page and who does it (CP-01). |
| An introduction about what the application does | Remove | The user already knows the application. Nothing on the page gives a reason to ask (CP-07). |
| Display name and "Log out" in the site header | Keep visible | Shows which Spotify account is logged in, and lets the user end the session on a shared device (user story 3). It is in the shared header, so that it is on each page (PB-01). |
| An illustration in the empty state | Remove | It gives no information (DC-05, LY-01). |
| Each published festival: name and year, dates, as one link to the Festival page | Keep visible | User stories 6 and 7. The name and the year identify the edition. |
| Section "Complete festivals" | Keep visible, when a published festival is complete | Explains the order (user story 10). There is no heading for the festivals to come, because the page title already names them. |
| The number of artists of each festival | Remove | It does not help the user choose a festival. |
| A status label "On now" | Remove | The dates show it. |
| Badge "Your playlist is made" after the festival name | Keep visible, when the user has a playlist for the festival | User story 8. It shows also when the playlist does not have all of the songs, because the playlist exists in Spotify. |
| The time of the last update on the Festivals page | Remove | The Festival page shows it, next to the action that uses it. |

### Festival

- **Principal task:** set the interest level of each artist on the lineup, then make or update the playlist (#15).
- **Who and from where:** a user, from a festival on the Festivals page, or from a bookmark. The user knows the festival and some of its artists. The user usually sets the levels over several visits (user story 19).
- **Necessary before the task:** the festival, the artists on the lineup, the genres of each artist (user story 17), and the interest level of each artist.
- **Necessary before the playlist action:** the number of songs and artists that the playlist will contain (user story 20). After the first playlist: the link to it, the time of the last update (user stories 32 and 34), and the artists that are new on the lineup since the last update (user story 21).
- **Necessary after an update:** the artists that the update added to the playlist and removed from it (user story 30).
- **Necessary before a level, for an artist that the user does not know:** the songs of the artist (user story 18). The predicted songs play in the Spotify embed player, and the link "Spotify" opens the artist. The setlist.fm link shows where the songs come from (user story 41).
- **Supporting detail:** the search, the filters and the sort. "No predicted songs" under an artist that gives no songs. The fallback text under an artist with songs from a Spotify search.

A lineup has approximately 150 artists, so one action sets a level (user story 14). Each artist has four radio buttons that look like segments. A selection saves the level immediately. With the keyboard, Tab moves from artist to artist, and the arrow keys change the level. Each level that the user sets is saved. A different user has different levels.

The application saves each change in the background, so the page shows no confirmation. When a save fails, the artist shows the level that the application saved last, and the problem under the artist (FN-02). The playlist count changes only after a save.

A user often does not know some artists on a lineup of 150. Under the genres of each artist, "Play the songs" opens the Spotify embed player below the line, with the first predicted song (#18). "Previous song", "Next song" and "Song 2 of 10" go through the predicted songs in order of prediction. At the end of a song, the player plays the next song. The button then says "Close the player". One player is open at a time, so a second "Play the songs" closes the first player. The player is part of the row, not an overlay, so it does not cover the interest levels or other artists (QA-06). In the reading order and the Tab order, the player is between the button and the interest levels of the same artist.

The page uses the Spotify iFrame API, not the `preview_url` field. Spotify removed that field for new apps in November 2024. The page loads the API from Spotify only after the first "Play the songs", so a page view sends no request to Spotify. The embed player plays the full song when the user is logged in to Spotify in the browser. Otherwise it plays a preview. Spotify shows this in the player, so the page does not explain it (CP-07). When the API does not load, the player shows "The Spotify player did not load. Try again later.", and the song buttons are disabled. A search, a filter or a sort that hides or moves the artist closes the player, because a move loads the iframe again.

An artist with songs from the Spotify search fallback shows "The songs come from a Spotify search, not from setlists." The user can otherwise think that the artist plays these songs live (ED-04). It has no setlist.fm link. The link "setlist.fm" goes to the setlist.fm page of the artist. It is also the attribution that the setlist.fm terms require, so it is a usual link, not nofollow. The application gets the address of the setlist.fm page of the artist with the setlists, and stores it with the predicted songs. A result from before #18 has no address until the next calculation, so the artist has no setlist.fm link until then.

The links open in the same tab, as the other links on the page do (IN-06). Without JavaScript, the links show, and "Play the songs" does not, because the player needs the script.

The search, the filter and the sort apply together (FN-05). The address keeps them, so that a reload and Back show the same list. A change of interest level does not hide or move an artist. Otherwise, the artist can leave the screen before the user can correct a mistake. When the list is out of date, the page tells the user and gives "Update the list" (CP-01: the user sees an artist that does not agree with the filter).

Without JavaScript, the radio buttons are one form, and "Save the interest levels" saves all of them. The search, the filter and the sort do not show, because they need the script.

Empty states: a search or a filter without results says which condition gave no artist, and gives "Show all artists".

The Playlist panel is above the lineup. A user who comes back usually wants to update the playlist, and a lineup of 150 artists puts the end of the page far away. The panel gives the number of songs and artists, then the action. The number changes after each saved level, so the user sees the length before the action (user story 20). An artist with no predicted songs gives no songs. The count therefore says "149 of 150 artists", and the artist shows "No predicted songs", so that the user can find the artist that the count does not include (CP-01).

"Make the playlist" makes a private playlist "{festival} {year}" in the Spotify account of the user. The button then becomes "Update the playlist", which sets the songs of the same playlist. The request waits for Spotify, which can take some seconds for a large playlist. The script disables the button and changes its label, so that a second select does not make a second playlist. The server also refuses a second request for the same playlist while the first one runs.

An update replaces the items of the same Spotify playlist, so that the links and the followers stay (user story 29). It uses the current interest levels and the current lineup. A lineup name that is no longer on the lineup is not in the playlist after the update (user story 53). The application changes the playlist only when the user selects "Update the playlist" (user story 31). A new lineup or a new level does not change it.

After each complete update, the application keeps the lineup of that update and the number of songs of each artist. The next update compares with it. The confirmation then gives the artists that the update added and removed, because the user asks "what changed?" (user story 30). An artist that is removed and is not an artist on the lineup now shows "(not on the lineup)". Otherwise the user can ask "why did this artist go? I did not change it." (CP-01). An update that does not change the artists says "No artist was added or removed.", so that the user does not look for a list. The first update gives no list, because each artist is added. A list with more than 6 artists uses two columns on a wide screen, so that it stays short.

An artist that is on the lineup now but was not on the lineup at the last complete update is new (user story 21). This includes a name that the admin matched after the update. Each new artist has the badge "New" after its name. The Playlist panel gives the number of new artists before the action, because the user must set their levels before the update. The filter "Only new artists" shows only when an artist is new. With 150 artists, it is the fast way to find them. An artist stays new until the next complete update. Before the first update, no artist is new.

The confirmation shows only after Spotify accepted each request (FN-02). A failure shows the Festival page with a problem notice. The heading tells the user what happened to the playlist: not made, did not change, or does not have all of the songs (user story 33). The text gives the cause from Spotify, and the wait after a rate limit, or "Try again later.". When Spotify stops after some of the songs, the playlist exists but is not complete. After the notice, the panel shows a warning until an update completes.

| Content | Decision | Reason |
|---|---|---|
| Link "Festivals" above the title | Keep visible | The way back. It has the title of its destination (IA-05). |
| Page title "{festival} {year}" | Keep visible | Identifies the festival. It is the playlist name. |
| Dates | Keep visible | Identify the edition. |
| Panel "Playlist" | Keep visible, above the lineup | Groups the playlist count, the link, the last update and the action. |
| "The playlist will contain N songs by A of M artists." | Keep visible | User story 20. Artists at Not interested and artists without predicted songs give no songs. |
| Button "Make the playlist", then "Update the playlist" | Keep visible | User story 22. The principal action of the panel. The label names the result (CT-04). |
| Link "Open {festival} {year} in Spotify" | Keep visible, after the playlist is made | User story 34. The playlist name in the link agrees with the name in Spotify (user story 24). |
| "Last update: {date} at {time}" | Keep visible, after the first complete update | User story 32. |
| "Warning: the playlist in Spotify does not have all of the songs. Update the playlist." | Keep visible, when the last attempt stopped after some of the songs, except when the notice says it | The playlist exists but is not complete. The text gives the correction. |
| Notice "Made the playlist {festival} {year} in Spotify" or "Updated …" | Keep visible, after a success only | CP-03, FN-02. The panel below gives the count, so the notice does not repeat it (IA-03). |
| "Added N artists" and "Removed N artists" with the lineup names, in the "Updated …" notice | Keep visible, after an update with changes only | User story 30. The headings give the number. Names in alphabetical order. |
| "(not on the lineup)" after a removed artist | Keep visible, when the artist is not an artist on the lineup now | Explains a removal that the user did not start (CP-01, user story 53). |
| "No artist was added or removed." | Keep visible, after an update without changes to the artists | Answers "what changed?" when the answer is "nothing". |
| Changes of the songs of each artist (for example 2 songs to 7 songs) | Remove | The user changed the level, so the user knows the change. Spotify shows the songs. |
| "N artists are new on the lineup since your last update." in the Playlist panel | Keep visible, when one or more artists are new | User story 21. Tells the user to set levels before the update. |
| Badge "New" after the artist name | Keep visible, for each new artist | User story 21. Identifies the new artists in the list. The radio group of the artist has it in its description. |
| Checkbox "Only new artists" in the lineup tools | Keep visible, with the script and when one or more artists are new | Finds the new artists in a lineup of 150. The address keeps it, as the other filters. |
| Problem notices: "The application did not make the playlist", "The playlist did not change", "The playlist in Spotify does not have all of the songs", "The playlist would contain no songs", "The application is already making this playlist" | Keep visible, after a failure only | User story 33. Each heading states the result for the playlist. The text gives the cause and the next action. |
| "No predicted songs" under an artist | Keep visible, when the artist has no predicted songs | Explains why the count does not include the artist (CP-01). |
| The playlist description and the setlist.fm attribution | Remove from the page | They are in the playlist in Spotify. The page has no reason to show them. |
| The song count of each level (2, 4, 7) | Remove | The count changes after each level, so the user sees the result. The numbers are settings. |
| A list of the songs in the playlist | Remove | Spotify shows the playlist. The player of each artist plays its predicted songs. |
| Button "Play the songs" under the genres, then "Close the player" | Keep visible, with the script and when the artist has predicted songs | User story 18. Small secondary style, because the interest levels are the principal task of the row. The visually hidden artist name makes each label specific. |
| Spotify embed player, "Previous song", "Song N of M", "Next song" | Keep visible, under the artist after "Play the songs" only | User story 18. The position tells the user how many predicted songs there are. The song name is in the player. |
| "The Spotify player did not load. Try again later." | Keep visible, in the player, when the Spotify iFrame API does not load | FN-04 error state. |
| Link "Spotify" (accessible name "{artist} on Spotify") | Keep visible, when the artist has a Spotify artist | User story 18. Spotify has the other songs and the albums of the artist. The visible label is only the destination, so that the line fits next to the interest levels at 1280 px (CT-04: the label names the destination). |
| Link "setlist.fm" (accessible name "{artist} on setlist.fm") | Keep visible, when the songs come from setlists | User story 41. The setlist.fm attribution. Not nofollow. |
| "The songs come from a Spotify search, not from setlists." | Keep visible, for an artist with the Spotify search fallback | ED-04: the songs are not predicted. It replaces the setlist.fm link. |
| The song names as text, the look-back period and the long look-back mark | Remove | The player shows the song names. The look-back period is a detail of the method. The admin checks it on Predicted songs for one name. |
| Section "Lineup" | Keep visible | The principal task. |
| Search field "Search by artist name", select "Interest level", select "Sort by" | Keep visible, with the script only | User stories 15 and 16. The accents and the case are not important in the search. |
| The number of artists in the list ("150 artists", "12 of 150 artists") | Keep visible | Shows the result of the search and the filter. |
| "No artist matches “…”.", "No artist has the interest level …", and "Show all artists" | Keep visible, when the list is empty | FN-04 empty state. Names the condition that gave no result. |
| "Your last changes do not move or hide artists until you update the list." and "Update the list" | Keep visible, after a change that the filter or the sort does not show yet | Explains why an artist does not agree with the filter or the order. |
| Each artist: lineup name, the first 3 genres, the four interest levels | Keep visible | User stories 11 to 13 and 17. The names are the lineup names, as the festival gives them. An artist without genres on MusicBrainz shows no genre line. |
| "The application did not save the interest level. Select it again." | Keep visible, under the artist, after a failed save | FN-02. The level goes back to the saved level. |
| Button "Save the interest levels" and the notice "Saved the interest levels" | Keep visible, without JavaScript only | The form needs a submit action when the script does not run. |
| Lineup names marked "no match" | Remove | They are not artists, and playlists get no songs for them. |
| A save button or a confirmation for each change | Remove | Each change saves immediately. A failure shows under the artist. |
| Text that explains the default level Curious | Remove | Each artist shows Curious as the chosen level. Nothing on the page gives a reason to ask (CP-07). |

### Manage festivals

- **Principal task:** see each festival and the state of its lineup. Start to add a festival. Publish a festival when its artist matches are complete. After a lineup check, find the new names and match them (#17).
- **Who and from where:** the admin, from the link "Manage festivals" in the site header, or after "Add the festival". The admin knows the festivals, Clashfinder and the `.env` file.
- **Necessary before the task:** the festivals, the dates, the lineup source, the number of lineup names and the time of the last lineup. When the last attempt failed: the time, the cause and if the festival kept its lineup. After a lineup check that changed the lineup: the new names and the removed names.
- **Supporting detail:** the expected genres. The admin can check them before the artist matches (#7).

The admin asks "did Clashfinder give the lineup?" after each action. The notice at the top answers it from the database, not from the request (FN-02). A failure notice does not repeat the cause, because the festival below shows it (IA-03). The festival keeps the cause after a reload, so the notice is not the only place for it.

The application checks the lineup of each published festival once a day until the festival starts (#17, user story 47). The admin asks "do I still need to get the lineup again?". The fact "Lineup check: Each day until the festival starts" answers it for each festival that gets the check. A check by the admin also counts as the check of the day. The page does not say this, because nothing on the page gives a reason to ask (CP-07).

The admin asks "what changed, and what must I match?" after a check (user story 48). The fact "Last lineup change" gives the time, the new names and the removed names of the last check that changed the lineup. A check without changes does not replace it, so the admin does not lose the names of a change from an earlier day. Each new name is a link to its row on Admin: artist matches. A change of the lineup source can remove all names, so each list shows a maximum of 10 names and then "and N more". A published festival stays published after a change (user story 52). Users see a new name only after it has an artist match, so the page does not warn about publication.

A failure caused by the API key needs a change to the `.env` file. The cause therefore names the two settings (ED-04: the correction, not only the HTTP status).

| Content | Decision | Reason |
|---|---|---|
| Page title "Manage festivals" | Keep visible | Agrees with the header link (IA-05). |
| Button "Add a festival" | Keep visible | The principal action. It opens the Add a festival page (CT-04). |
| Notice after an action | Keep visible, after an action only | States the completed action first (CP-03), or the failure. |
| Festival name and year, dates | Keep visible | Identify the festival. The name and the year are the playlist name. |
| Status label "Published" or "Not published" | Keep visible | Tells the admin if users see the festival. |
| Button "Publish" | Keep visible, when the festival is not published, has a lineup and each lineup name has an artist match or a "no match" mark | The principal action for a festival with complete artist matches (user story 51). Hidden text names the festival for screen readers. A published festival has no "Publish" button. Version 1 has no action to remove a publication. |
| Hint "You can publish the festival when each lineup name has an artist match or a “no match” mark." | Keep visible, instead of "Publish", when names have no match | The admin expects a publish action. The hint tells the admin why it is not there. The Artist matches fact above it gives the number of names without a match, so the hint does not repeat the number (IA-03). |
| Hint "You can publish the festival when it has a lineup." | Keep visible, instead of "Publish", when the festival has no lineup | The same question, for a festival without a lineup. |
| Notice "Published {festival}" with "Users can see it on the Festivals page." | Keep visible, after "Publish" only | CP-03. The page reads the state from the database (FN-02). |
| Notice "The application did not publish {festival}" | Keep visible, after "Publish" with names without a match only | Possible from an old page, after a new lineup. The festival in the list shows the cause. |
| Lineup source, with a link to the Clashfinder page | Keep visible | The admin can check the page that gives the lineup. |
| Lineup: number of names and time | Keep visible | Answers "did the application get the lineup, and when?". |
| Lineup problem: time, cause, "keeps its previous lineup" | Keep visible, after a failure only | User story 49. The admin decides to correct the source or to try again. |
| Expected genres | Supporting detail | Necessary for the genre warnings in #7. |
| Button "Get the lineup again" | Keep visible, secondary style | ADR-0006: the application gets a lineup again when the admin asks, and in the daily lineup check of a published festival. The admin uses it before publication, or after a correction. Hidden text names the festival for screen readers. |
| Empty-state text about publication | Remove | The empty page gives no reason to ask about publication (CP-07). The status label shows it for each festival. |
| Artist matches: number of names without a match, and a link | Keep visible, when the festival has a lineup | Tells the admin which festival needs work. The link opens Admin: artist matches. Hidden text names the festival for screen readers. |
| The lineup names | Remove | The Admin: artist matches page shows them (#7). |
| Link "Change the lineup source", below the Clashfinder page | Keep visible, small | User story 50. Opens Change the lineup source. Hidden text names the festival for screen readers. |
| Fact "Lineup check: Each day until the festival starts" | Keep visible, for a published festival before its first day | User story 47. Tells the admin that new names come without an action. |
| Fact "Last lineup change": the time, "N new names:" with a link for each name, "N removed names:" | Keep visible, after a lineup check that changed the lineup | User story 48. The admin finds the new names to match. The removed names explain a smaller lineup. |
| "The lineup check found N new names and N removed names." in the notice after "Get the lineup again" or a change of the lineup source | Keep visible, when the action changed the lineup | CP-03: the completed action first, then the result. |
| Notice "Changed the lineup source of {festival}" with "Got N lineup names from Clashfinder." | Keep visible, after a change of the lineup source | CP-03. The page reads the result from the database (FN-02). |
| Notice "Changed the lineup source of {festival}" with "The application did not get the lineup from the new source." | Keep visible, after a change of the lineup source that did not get the lineup | The source is changed, but the lineup is from the old source. The cause is with the festival in the list. |
| The time of each lineup check without changes | Remove | The fact "Lineup" gives the time of the last lineup. A list of checks does not help the admin match names. |
| A warning that a published festival has names without a match | Remove | Users do not see names without a match. The fact "Artist matches" already gives the number. |

### Add a festival

- **Principal task:** add a festival and choose its lineup source.
- **Who and from where:** the admin, from "Add a festival". The admin knows the festival dates, and usually knows that Clashfinder has a page for the festival.
- **Necessary before the task:** the fields, the Clashfinder search, and sufficient information to choose between duplicate pages.
- **Supporting detail:** the address of each page on Clashfinder, to look at the page before the choice.

The admin asks "which page is the correct one?". Users make the Clashfinder pages, so a festival often has duplicates. Some names do not contain the festival name, for example "DLXXIV" (ADR-0004). Each result therefore shows the start date, the days, the stages, the acts, the last change and the Clashfinder marks "Official page" and "Core page". The search also shows the other pages that start on the festival dates. The hint under the search field states this, because the admin does not expect pages with a different name (CP-01).

The search is a GET request, so Back, refresh and the address show the same results. "Add the festival" shows only after a search, because the admin cannot add a festival without a Clashfinder page. Before a search, "Search Clashfinder" is the principal action. After a search, it is a secondary action.

After "Add the festival", the browser waits for the Clashfinder export. Because of the crawl delay, the wait can be 10 seconds. The browser shows its usual loading state. The page has no separate loading state, because the server renders each page (FN-04).

| Content | Decision | Reason |
|---|---|---|
| Link "Manage festivals" above the title | Keep visible | The way back to the festival list. |
| Fields: name, year, first day, last day, expected genres | Keep visible | User story 43. |
| Hint for expected genres | Keep visible | Prevents a probable error: the field takes a list. |
| Heading "Lineup source: Clashfinder" | Keep visible | States the lineup source. Version 1 has one source, so there is no choice control (LY-01). |
| Hint under the search field | Keep visible | Explains why the results contain pages with a different name. |
| Result groups "Pages that match" and "Other pages that start on the festival dates" | Keep visible | The admin sees why each page is in the results. |
| Facts and Clashfinder marks of each page | Keep visible | The information to choose between duplicates (user story 45). |
| Link "Open … on Clashfinder" | Supporting detail | Opens in a new tab, so that the form stays. |
| Error summary | Keep visible, with problems only | Links to each field (FN-03). It has focus after the page opens. |
| Text that says that an empty search field uses the festival name | Remove | The results heading shows the search text that the search used. |
| A loading indicator | Remove | The server renders each page. The browser shows the loading state. |

### Change the lineup source

- **Principal task:** choose a different Clashfinder page for the lineup of a festival (user story 50).
- **Who and from where:** the admin, from "Change the lineup source" on Manage festivals, usually after a lineup problem or when a better page appears. The admin knows the festival and the current page.
- **Necessary before the task:** the current lineup source, the Clashfinder search, and the facts that tell duplicate pages apart (the same as Add a festival).
- **Supporting detail:** the address of each page on Clashfinder.

The page uses the search and the page choices of Add a festival (PB-01). The search field starts with the festival name, but the page does not search until the admin selects "Search Clashfinder", so that opening the page sends no request. After "Change the lineup source", the application gets the lineup from the new page at once, and Manage festivals shows the result. The page does not explain this before the action, because the notice states it (CP-07). The artist matches belong to the name text, so the names that are also on the new page keep their matches. The page does not say this, because nothing on the page suggests that matches go. Version 1 has one lineup source, so the admin chooses a page, not a source type. When the festival app sources come (#20), this page gets the choice of the source.

A choice of the current page is not a change. The application gets the lineup again, and the notice is "Got the lineup of {festival}".

| Content | Decision | Reason |
|---|---|---|
| Link "Manage festivals" above the title | Keep visible | The way back. |
| Page title "Change the lineup source of {festival}" | Keep visible | States the task and the festival (CT-04). |
| Fact "Lineup source now" with a link to the Clashfinder page | Keep visible | The admin compares the results with it. |
| Heading "New lineup source: Clashfinder", search field, hint, "Search Clashfinder" | Keep visible | The same as Add a festival. |
| Page choices | Keep visible, after a search | The same as Add a festival. |
| Button "Change the lineup source" | Keep visible, after a search with results | The principal action. Before a search, there is nothing to choose. |
| Error summary "Correct the problem to change the lineup source" | Keep visible, after the action without a choice | FN-03. It gets focus when the page opens. |
| Text about the matches after a change | Remove | CP-07. |

### Admin: artist matches

- **Principal task:** match each lineup name that has no artist match. Check the genre warnings and the Spotify artists.
- **Who and from where:** the admin, from "Match the artists" on Manage festivals, usually just after "Add the festival" or "Get the lineup again". The admin knows the festival and most of its artists, and knows MusicBrainz a little.
- **Necessary before the task:** the names without a match, the proposed artist of each name, and the facts that tell artists with the same name apart: disambiguation, type, country, active years and genres (user story 57). The expected genres, because the warnings compare with them.
- **Supporting detail:** the other possible artists, the link to each artist on MusicBrainz, and the list of matches with the Spotify artist of each match.

A lineup has approximately 150 names. MusicBrainz accepts 1 request each second (ADR-0003), so the searches take approximately 3 minutes. The searches therefore run in the background after the application gets a lineup, and the results stay in the database. The page shows the number of names that wait for a search, and the rate, because the admin asks "how long?". The page does not change by itself. The admin selects "Show the new results", because an automatic reload can lose a choice.

The admin asks "is this the correct artist?" for each name. The proposal is chosen, so one action saves it (user story 56). When a choice is chosen, the other possible artists are in a closed group ("Show 4 other artists"). This keeps a list of 150 names short. When nothing is proposed, all possible artists show.

A genre warning prevents a probable error: a match to a different artist with the same name. Each possible artist with none of the expected genres shows the warning before the save. After the save, the notice repeats the warning, and the match is first in the list of matches (user story 58). The warning does not stop the save (user story 59).

The first failure stops the searches, because the next searches probably fail for the same cause. The notice gives the time and the cause, and "Search again" starts the searches again. After a failure, opening the page does not start them, so that a broken service does not get requests each time the admin opens the page.

Each match to an artist gets a Spotify artist (#8, user story 63). The application uses the MusicBrainz Spotify link, or a Spotify search when there is no link. This also runs in the background, with the same rules for progress and failure. The admin asks "are the songs from the correct artist?". Each match therefore shows the Spotify artist, a link that opens it in Spotify, and the source. The source tells the admin which artists to check: a search result can be a different artist with the same name, for example the Swedish "Ghost" for the Japanese band. A match without a Spotify artist shows a warning with its consequence (ED-04). "Set the Spotify artist" opens the page where the admin corrects it (user story 64).

Each match with a Spotify artist gets predicted songs (#12, user story 65). Festival sets count 2, and all the other shows of one tour together count a maximum of 3 shows (#13, user story 36). A show is a festival set when MusicBrainz has a festival of the artist on the date, or when setlist.fm has 10 or more artists at the venue on the date. An album-focused show counts 0.1, and a cover is kept only when it is in the 10 songs with the highest score and Spotify has a recording of it by the performing artist (#14, user stories 38 and 39). These rules change the order of the songs, not the page. The calculation runs in the background after the Spotify artist is found, with the same rules for progress and failure. A rate limit delays the calculation but does not stop it (user story 71). A result stays valid for 6 months, so a second festival with the same artist starts no new calculation (user story 69). Each match shows the number of songs, because the admin asks "does each artist have songs?". An artist without setlists in the look-back period shows a warning, because its songs come from a Spotify search and are not predicted (user story 68). An artist with fewer than 5 shows in the last 18 months gets songs from the setlists of 3 or 5 years (#14). Its row shows a warning, because the admin asks "which predictions are less reliable?" (user story 67). The warning names the cause and the period, not the method.

| Content | Decision | Reason |
|---|---|---|
| Link "Manage festivals" above the title | Keep visible | The way back. |
| Page title "Artist matches for {festival}" | Keep visible | States the task and the festival. |
| Notice after a save | Keep visible, after a save only | States the saved match (CP-03). The warning notice also gives the genre warning. The page reads the match from the database (FN-02). |
| Expected genres | Keep visible | The genre warnings compare with them. |
| Section "Names without an artist match (N)" | Keep visible | The principal task. The count tells the admin how much work stays. |
| "N names wait for the MusicBrainz search. The search does 1 name each second." and "Show the new results" | Keep visible, while names wait | Answers "where are the results?" and "how long?". |
| Notice "The MusicBrainz search stopped", with the cause and "Search again" | Keep visible, after a failure only | FN-04 error state. |
| For each name: the proposed artist (badge "Proposed"), "No match", "Save the match" | Keep visible | One action confirms the proposal. |
| Facts, genres (the 5 with the most votes) and genre warning of each artist | Keep visible | User stories 57 and 58. |
| The other possible artists | Supporting detail, in a closed group | Necessary only when the proposal is wrong. |
| "No match" hint "The name is not one artist. Playlists get no songs for it." | Keep visible | ED-04: the consequence of the choice for users. |
| Link "Search with a different text" | Keep visible, small | For a name that the search did not find, for example a name with a different spelling. |
| Link "Open … on MusicBrainz" | Supporting detail | Opens in a new tab, so that the choice stays. |
| Section "Artist matches (N)", the matches with a warning first, and "Change" | Keep visible, below the principal task | User story 62. Matches from other festivals also show here (user story 61). |
| For each match: "Spotify artist: {name} · from the MusicBrainz link", "· from a Spotify search" or "· set by hand", with a link that opens the artist in Spotify | Keep visible, in the match row | User story 63. The source shows which artists to check. The link opens in a new tab, so that the page stays. |
| "Warning: no Spotify artist found. Playlists get no songs for this artist." | Keep visible, for a match without a Spotify artist | ED-04: the consequence for users. It uses the genre warning style. |
| Link "Set the Spotify artist" | Keep visible, small, next to "Change" | User story 64. |
| "N artists wait for the Spotify artist. The application finds 1 artist in approximately 2 seconds." and "Show the new results" | Keep visible, while artists wait | Answers "where is the Spotify artist?" and "how long?". Each artist needs 2 or 3 requests. |
| Notice "The search for Spotify artists stopped", with the cause and "Find the Spotify artists again" | Keep visible, after a failure only | FN-04 error state. A Spotify quota error or rate limit shows its cause (ADR-0001). |
| Notice "Set the Spotify artist of {artist} to {Spotify artist}" | Keep visible, after a save on Spotify artist for one name | CP-03. The page reads the Spotify artist from the database (FN-02). |
| Spotify artist images, popularity or genres | Remove | Development Mode does not give popularity. The name, the source and the link are sufficient to check the artist in Spotify. |
| Text that says that a match applies to all festivals | Remove | Nothing on the page gives a reason to ask (CP-07). A name with a match from a different festival is already in "Artist matches". |
| The MusicBrainz search score | Remove | It does not help the admin choose. The order of the choices shows it. |
| An automatic reload or a progress bar | Remove | A reload can lose a choice. The server renders each page. |
| For each match with a Spotify artist: "Predicted songs: N songs from setlists", or "Predicted songs: waiting" | Keep visible, in the match row | User story 66. The admin sees that each artist has songs, without opening each artist. |
| "Warning: no setlists in the last 60 months. N songs from a Spotify search." | Keep visible, in the match row, in the genre warning style | User story 68. The admin asks "where is the playlist weaker?". ED-04: the consequence is that the songs are not predicted. The period is the longest look-back period, because the application looks back 5 years before it uses the fallback (#14). |
| "N artists have no setlists in the last 60 months and use the Spotify search fallback." | Keep visible, below the section heading, when 1 or more artists use it | User story 68. The admin finds the fallback artists without reading each row. |
| "Warning: fewer than 5 shows in the last 18 months. N songs from setlists of the last 60 months." | Keep visible, in the match row, in the genre warning style, for a result with the long look-back mark | User story 67. The admin asks "which predictions are less reliable?". The period tells the admin how old the setlists can be. |
| "N artists have fewer than 5 shows in the last 18 months and use older setlists." | Keep visible, below the section heading, when 1 or more artists have the long look-back mark | User story 67. The admin finds these artists without reading each row. |
| Which shows were album-focused, and which covers were removed | Remove | The store keeps no setlist.fm data (ADR-0002). These rules change the order, and the admin checks the songs on Predicted songs for one name. |
| "Warning: no predicted songs on Spotify. Playlists get no songs for this artist." | Keep visible, for an artist with no tracks | ED-04: the consequence for users. |
| Link "Show the predicted songs" | Keep visible, small, next to "Set the Spotify artist" | Opens Predicted songs for one name. |
| "N artists wait for the predicted songs. The application calculates 1 artist in approximately 10 seconds to 1 minute." and "Show the new results" | Keep visible, while artists wait | Answers "where are the songs?" and "how long?". The first calculation of an artist with many shows takes approximately 1 minute, because it checks each venue and date for a festival set (#13). After a rate limit, the text also gives the time at which the calculation continues (user story 71). |
| Notice "The calculation of the predicted songs stopped", with the cause and "Calculate the predicted songs again" | Keep visible, after a failure only | FN-04 error state, with the same rules as the other background work. A rate limit does not stop the calculation. It waits. |
| Badge "New" after a lineup name | Keep visible, for each name that the last lineup change added (#17) | User story 48. The admin opens a new name from Manage festivals and finds it in a list of 150 names. The badge has the same meaning as on the Festival page: new since the last change. |
| Song names on this page | Remove | The store keeps only Spotify track IDs (ADR-0002). A name needs a Spotify request for each song. The Predicted songs page shows the songs. |

### Artist match for one name

- **Principal task:** find the correct artist for one lineup name and save the match, or change a match.
- **Who and from where:** the admin, from "Search with a different text" or "Change" on Admin: artist matches.
- **Necessary before the task:** the lineup name, the search field, the possible artists with their facts, and the current match.

The search field contains the lineup name. The admin can enter a different spelling, or paste the address of a MusicBrainz artist page. The label names both, because the admin does not expect that an address works in a search field (CP-01). The search is a GET request, so Back, refresh and the address show the same results. The current match is chosen and has the badge "Current match". It is a choice also when the new search does not find it. All possible artists show, because the admin opened the page to look further.

| Content | Decision | Reason |
|---|---|---|
| Link "Artist matches for {festival}" | Keep visible | The way back. |
| Page title "Artist match for {name}" | Keep visible | States the name. |
| Search field and "Search MusicBrainz" | Keep visible, secondary style | The reason to open the page. "Save the match" is the principal action. |
| Possible artists, "No match", "Save the match" | Keep visible | The same component as on Admin: artist matches (PB-01). |
| Problem "Choose an artist or “No match”." | Keep visible, after a save without a choice | FN-03. Possible only when nothing is proposed. |
| Search problem notice | Keep visible, after a failure only | Gives the cause. |

### Spotify artist for one name

- **Principal task:** set the Spotify artist of a match by hand, when the MusicBrainz link is missing and the search found a different artist or none (user story 64).
- **Who and from where:** the admin, from "Set the Spotify artist" on Admin: artist matches. The admin usually has Spotify open, and has found the correct artist there.
- **Necessary before the task:** the MusicBrainz artist of the match, the current Spotify artist and its source, and the field for the address.

The admin enters the address of the Spotify artist. This is the address that the Spotify share action copies. The field also accepts a Spotify URI or a Spotify ID. The hint tells the admin how to copy the address, because Spotify does not show the address of an artist page in its apps (CP-01). The application gets the artist from Spotify before the save, so that it saves only an artist that exists, with its name. A Spotify artist that the admin set by hand stays when the application finds the Spotify artist again, for example after a new save of the match.

| Content | Decision | Reason |
|---|---|---|
| Link "Artist matches for {festival}" | Keep visible | The way back. |
| Page title "Spotify artist for {name}" | Keep visible | States the lineup name. |
| Facts: MusicBrainz artist (with a link to MusicBrainz) and current Spotify artist (with a link to Spotify and the source) | Keep visible | The admin compares the two. |
| Field "Address of the Spotify artist", the hint and "Save the Spotify artist" | Keep visible | The principal task. |
| Problem: no address, an address that is not a Spotify artist, an artist that Spotify does not have, or a Spotify failure with its cause | Keep visible, after a save with a problem | FN-03. The field keeps the text. |
| A Spotify search on the page | Remove | The admin opens the page because the search was wrong. The admin finds the artist in Spotify. |
| Text that says that the application does not replace the artist | Remove | Nothing on the page gives a reason to ask (CP-07). The match shows "set by hand" after the save. |

### Predicted songs for one name

- **Principal task:** check the predicted songs of one artist, and calculate them again when they are wrong or old (user stories 66, 68 and 70).
- **Who and from where:** the admin, from "Show the predicted songs" on Admin: artist matches. The admin knows the artist, and recognises its well-known songs.
- **Necessary before the task:** the songs in order, the source of the songs (setlists, setlists with the long look-back mark, or the Spotify search fallback), and the time of the calculation.
- **Supporting detail:** the MusicBrainz artist and the Spotify artist, so that the admin can find a wrong artist as the cause of wrong songs. The end of the valid period.

The store keeps only Spotify track IDs, not song names (ADR-0002). The page therefore shows each song with the Spotify embed player. The player shows the song name and the artist, and the admin can listen to the song. This needs no Spotify request from the application. The players load only when they come into view. The Festival page uses the same Spotify embed player through the Spotify iFrame API (#18).

The calculation runs in the background, because it sends 1 or more setlist.fm requests and up to 20 Spotify requests. The first calculation of an artist also sends 1 MusicBrainz request and 1 setlist.fm request for each venue and date that is not a MusicBrainz festival day, to find the festival sets (#13). After "Calculate the predicted songs again", the page opens again and says that the calculation waits or runs. It shows the old songs until the new result is saved (FN-02). The admin selects "Show the new result".

An artist with fewer than 5 shows in the last 18 months gets songs from the setlists of 3 or 5 years (#14, user story 67). The source then gives the period and a warning that the prediction is less reliable, because the admin asks "can I trust these songs?". The album-focused rule and the cover rule change only the songs and their order (user stories 38 and 39), so the page does not explain them (CP-07).

A result stays valid for 6 months (user story 69). The page shows the end date, because the admin asks "will the application calculate this again before the festival?". It shows a date and not a time, because the time changes with British Summer Time.

| Content | Decision | Reason |
|---|---|---|
| Link "Artist matches for {festival}" | Keep visible | The way back. |
| Page title "Predicted songs for {name}" | Keep visible | States the lineup name. |
| Facts: MusicBrainz artist and Spotify artist, with links | Keep visible | A wrong Spotify artist is the most probable cause of wrong songs. "Set the Spotify artist" is on Admin: artist matches. |
| Fact "Calculated": the time, and "Valid until {date}" | Keep visible, when a result exists | User story 69. |
| Fact "Source": "Setlists on setlist.fm from the last 18 months", or the fallback warning | Keep visible, when a result exists | User story 68. "Setlists on setlist.fm" is a link to the setlist.fm page of the artist, when the result has the address (#18). It is the setlist.fm attribution. The warning says that the songs are not predicted (ED-04). The fallback warning gives the longest look-back period, 60 months (#14). |
| Fact "Source" with the long look-back mark: "Setlists on setlist.fm from the last 60 months." and "Warning: fewer than 5 shows in the last 18 months, so the prediction is less reliable." | Keep visible, when the result has the mark | User story 67. ED-04: the consequence is a less reliable prediction. The warning uses the genre warning style, as the other warnings about predicted songs do. |
| The album-focused shows, the removed covers and the scores | Remove | The store keeps no setlist.fm data (ADR-0002). The admin checks the result, not the method. |
| "Calculate the predicted songs again" | Keep visible, secondary style, above the songs | User story 70. It is secondary because the principal task is to check the songs. It is above the long list, so that the admin finds it without scrolling. |
| "The calculation of the predicted songs waits or runs." and "Show the new result" | Keep visible, while the artist waits | Replaces the button, so that the admin does not start the same calculation again. After a rate limit, it gives the time at which the calculation continues. |
| Notice "The calculation of the predicted songs stopped", with the cause | Keep visible, after a failure only | FN-04 error state. |
| Section "Songs in order of prediction (N)", a numbered list of Spotify players | Keep visible | The principal task. The numbers show the order (LY-06). |
| Empty state "The artist has no predicted songs" | Keep visible, when the artist has no Spotify artist | The calculation needs the Spotify artist. The text tells the admin what to do. |
| "Warning: Spotify has none of the songs. Playlists get no songs for this artist." | Keep visible, for a result with no tracks | ED-04: the consequence for users. |
| The scores, the shows and the setlists | Remove | The store keeps no setlist.fm data (ADR-0002). The admin checks the result, not the method. |

### Page not found

- **Principal task:** find the correct page after an incorrect or old address.
- **Who and from where:** a user or the admin, from an old bookmark, a typing error or a link that changed.
- **Necessary before the task:** the address does not exist, and a link to the Festivals page.

| Content | Decision | Reason |
|---|---|---|
| Wordmark | Keep visible | Same shared header as on all pages (PB-01). |
| Page title "Page not found" | Keep visible | States the result. |
| "The page at this address does not exist." | Keep visible | Tells the user that the address is the cause, not the server. |
| Link "Show the festivals" | Keep visible | The principal page of the application is the most probable destination (CT-04). |
| An error code, a technical message or a search field | Remove | The status 404 is in the response for the browser. A search has no content to search yet. |

## Typeface (VS-01)

The application uses the system interface typeface of each device (`system-ui` and its fallbacks). Reasons:

- The application is a tool that people use for a long time on a phone or a computer. The system typeface is the most legible typeface on each device, at small sizes too.
- The application sends no request to a font service. This agrees with the test rule that the browser loads files only from the application.
- The visual identity comes from the colours, the brand band and the weights, not from a display typeface.

## Type styles (VS-02, VS-03)

| Style | Element | Size | Weight | Line height | Colour role | Purpose |
|---|---|---|---|---|---|---|
| Wordmark | `.wordmark` | 1.0625rem | 700 | 1.5 | On brand | Application name in the site header |
| Page title | `h1` | 2rem | 750 | 1.2 | Ink | One for each page. Letter spacing −0.01em, to make the large size tighter. |
| Section heading | `h2` | 1.25rem | 650 | 1.3 | Ink | Sections and the empty-state heading |
| Lead text | `.lead` | 1.125rem | 400 | 1.5 | Ink | The first sentence of a page that has no section heading, for example Page not found |
| Body text | `body`, `p` | 1rem | 400 | 1.5 | Ink | Normal text |
| Supporting text | `.empty-state p`, `.festival-dates`, `.publication-hint`, `.lineup-count`, `.lineup-action`, `.playlist-updated`, `.change-reason` | 1rem | 400 | 1.5 | Muted | Text that explains or qualifies the text above it |
| Playlist count | `.playlist-count`, `.playlist-new` | 1rem | 400 | 1.5 | Ink | "The playlist will contain N songs by A of M artists." and "N artists are new on the lineup since your last update." on the Festival page. Ink, because it is information for a decision, not a qualification. |
| Change heading | `.notice .change-heading` | 1rem | 650 | 1.5 | Ink | "Added N artists" and "Removed N artists" in the confirmation after an update. 1rem space above separates the two lists. |
| Playlist link | `.playlist-link a` | 1rem | 650 | 1.5 | Link | "Open {festival} {year} in Spotify". The weight shows that it is the result of the principal action. |
| Artist name | `.artist-name` | 1rem | 650 | 1.5 | Ink | The lineup name of one artist on the Festival page |
| Artist genres | `.artist-genres` | 0.9375rem | 400 | 1.5 | Muted | The genres under the artist name, "No predicted songs" and the fallback text |
| Listen links | `.listen-links` | 0.9375rem | 400, 600 for the button | 1.5 | Link | "Play the songs", "Spotify" and "setlist.fm" under the genres. The same size as the genres, because they are supporting actions of the row. |
| Song position | `.listen-position` | 0.9375rem | 400 | 1.5 | Muted | "Song 2 of 10" between the song buttons |
| Interest level | `.level` | 0.9375rem | 400, 650 when chosen | 1.25 | Ink, Link when chosen | The label of one interest level. The weight and the colour show the chosen level together with the border. |
| Festival name in the festival list | `.festival-link .festival-name` | 1.125rem | 650 | 1.5 | Link | The festival name and year on the Festivals page. The link colour shows that the panel is a link. |
| Hint | `.hint`, `.choice-facts` | 0.9375rem | 400 | 1.5 | Muted | Text under a form label or a choice that helps the admin enter or choose a value |
| Label | `.label`, `.facts dt`, `.status-label`, `.badge` | 0.875rem | 600 | 1.4 | Ink | Form labels, fact names and status labels. Labels use sentence case, not uppercase (VS-06). |
| Field problem | `.field-problem` | 1rem | 600 | 1.5 | Problem | The problem of one form field and how to correct it, and a failed save of an interest level |
| Choice label | `.choice-label` | 1rem | 650 | 1.5 | Ink | The name of a Clashfinder page or a MusicBrainz artist in a list of choices |
| Lineup name heading | `.match-item-heading` | 1.125rem | 650 | 1.4 | Ink | One lineup name on Admin: artist matches. Smaller than a section heading, larger than a choice label. |
| Genre warning | `.genre-warning` | 0.9375rem | 600 | 1.5 | Warning | "Warning: none of the expected genres", "Warning: no Spotify artist found", the warnings about predicted songs and the warning about a playlist that does not have all of the songs. The text starts with "Warning", so the colour is not the only sign. |
| Matched lineup name | `.matched-lineup-name` | 1rem | 650 | 1.5 | Ink | The lineup name in the list of artist matches |
| Matched artist | `.matched-artist`, `.matched-spotify` | 0.9375rem | 400 | 1.5 | Muted | The artist of a match, with its facts, its Spotify artist and its predicted songs |
| Song number | `.predicted-song-list > li::before` | 1rem | 600 | 1.5 | Muted | The position of a song in the order of prediction |
| Disclosure label | `.more-choices summary` | 1rem | 600 | 1.5 | Link | "Show 4 other artists" |
| Header link | `.header-link` | 0.9375rem | 600 | 1.5 | On brand | "Manage festivals" in the site header, for the admin only |
| Button label | `.button` | 1rem | 650 | 1.5 | On brand | The principal action |
| Account name | `.account-name` | 0.9375rem | 400 | 1.5 | On brand | The display name of the logged-in user in the site header |
| Header button label | `.header-button` | 0.9375rem | 600 | 1.4 | On brand | "Log out" in the site header |

The difference in size and weight between the page title and the section heading shows the hierarchy. The application does not use italic or a different typeface for emphasis.

## Colour roles (VS-04, VS-05)

| Role | Property | Value | Use |
|---|---|---|---|
| Page | `--colour-page` | #f6f2ec | Background of the page |
| Surface | `--colour-surface` | #fffdfa | Background of panels that stand on the page |
| Ink | `--colour-ink` | #1f1a24 | Headings and body text |
| Muted | `--colour-muted` | #5c5466 | Supporting text |
| Rule | `--colour-rule` | #ded5c9 | Panel borders and list dividers |
| Brand | `--colour-brand` | #1c1626 | Site header band, browser icon, theme colour |
| On brand | `--colour-on-brand` | #f6f2ec | Text on the brand colour |
| Link | `--colour-link` | #a3134f | Links (also the festival name in a festival link panel), the strip under the site header, the background of the principal action button, and the border of a festival link panel when the pointer is on it |
| Action hover | `--colour-action-hover` | #85103f | Background of the principal action button when the pointer is on it |
| Problem | `--colour-problem` | #b42318 | The strip on a notice or a field with a problem, and the text of a field problem |
| Success | `--colour-success` | #1e7b4a | The strip on a confirmation notice. Not used for text. |
| Warning | `--colour-warning` | #94510a | The text of a genre warning and of a Spotify artist warning, and the strip on a warning notice. A warning does not stop an action. A problem does. |
| Selected | `--colour-selected` | #f9eef2 | Background of the chosen Clashfinder page and the chosen interest level, and of a secondary button, a festival link panel or an interest level when the pointer is on it |
| Badge | `--colour-badge` | #efe8df | Background of status labels and badges |
| Focus | `--colour-focus` | #a3134f | Focus indicator on the page and on surfaces |
| Focus on brand | `--colour-focus-on-brand` | #ff9cc4 | Focus indicator in the site header |

Contrast ratios (WCAG 2.2). Text needs 4.5:1. A focus indicator needs 3:1.

| Foreground | Background | Ratio |
|---|---|---|
| Ink | Page | 15.29:1 |
| Ink | Surface | 16.79:1 |
| Muted | Page | 6.46:1 |
| Muted | Surface | 7.10:1 |
| Link | Page | 6.81:1 |
| Link | Surface | 7.48:1 |
| On brand | Brand | 15.80:1 |
| On brand | Link (button) | 6.81:1 |
| On brand | Action hover | 8.79:1 |
| Brand | On brand (header button, pointer on it) | 15.80:1 |
| Focus on brand | Brand | 9.06:1 |
| Problem strip (not text, needs 3:1) | Surface | 6.47:1 |
| Problem (field problem text) | Page | 5.90:1 |
| Problem (field problem text) | Surface | 6.47:1 |
| Success strip (not text, needs 3:1) | Surface | 5.19:1 |
| Muted (input border, not text, needs 3:1) | Surface | 7.10:1 |
| Ink | Selected | 15.05:1 |
| Muted | Selected | 6.36:1 |
| Link | Selected | 6.71:1 |
| Ink | Badge | 14.03:1 |
| Warning (genre warning text) | Surface | 6.01:1 |
| Warning (genre warning text) | Selected | 5.39:1 |
| Warning (genre warning text) | Page | 5.47:1 |
| On brand (header link) | Brand | 15.80:1 |

The application has only a light colour scheme in version 1. The standards test measures the contrast of the rendered pages.

## Component roles (DC-01, DC-03, DC-06)

| Component | Treatment | Role |
|---|---|---|
| Site header | Brand background, 4px strip in the link colour at the bottom, no radius, no shadow | Visual identity. The strip separates the header from the page. It is not interactive. |
| Content column | Maximum width 60rem, side padding 1rem (2rem from 40rem width) | Keeps the header and the page content aligned, and keeps lines at a legible length. |
| Empty-state panel | Surface background, 1px rule border, radius 12px (`--radius-panel`), no shadow, maximum width 36rem | Groups the empty-state message, so that it reads as a state of the page and not as a section. |
| Festival link panel | Surface background, 1px rule border, radius 12px, no shadow. The name and the badge "Your playlist is made" at the left, the dates at the right, or below the name on a narrow screen. When the pointer is on it: selected background, link border, underlined name. Maximum width 40rem. | One published festival on the Festivals page. The full panel is one link to the Festival page (LY-02). |
| Complete festivals | Section heading, 2.5rem space above | Separates the complete festivals from the festivals to come. |
| Lineup list | 1px rule dividers, no radius, full column width. Each row: the name and the genres at the left, the interest levels at the right. Below 48rem width, the interest levels go below the name, with four equal columns. | The artists on the Festival page. The rows are a list to scan, not separate items to compare. |
| Interest levels | Four segments, each one a radio button that covers the segment. Surface background, 1px rule border, radius 8px, minimum height 2.75rem. Chosen: 2px link border, selected background, link text, weight 650. Pointer on it: selected background. Keyboard focus: the focus indicator around the segment. | The interest level of one artist. The chosen state is the same as the page choice (PB-01). Each segment is a large target for touch (WCAG 2.5.8). |
| Playlist panel | Surface background, 1px rule border, radius 12px, no shadow, maximum width 40rem. The section heading, the link and the last update, the count, then the principal action button. | The playlist of the user on the Festival page. A panel separates it from the lineup, which is a list without panels. |
| Lineup tools | Search field, then two selects, then the checkbox "Only new artists" when it shows, on one row. On a narrow screen, the search field has its own row, the two selects share the next row, and the checkbox has its own row. | Search, filters and sort on the Festival page. They show only when the script runs. |
| Checkbox | Native checkbox, 1.25rem, link accent colour. The full label is the target, with a minimum height of 2.75rem, so that it aligns with the selects. | "Only new artists" on the Festival page. |
| Change list | A list with markers in the confirmation notice. More than 6 artists: two columns of minimum 12rem, so one column on a narrow screen. | The added or removed artists after an update. |
| Publish button | The principal action button, in the festival panel above "Get the lineup again" | The principal action for one festival on Manage festivals. It shows only when the admin can publish the festival, so a page has few of them. |
| Principal action button | Link background, on-brand text, radius 8px (`--radius-control`), no border, no shadow. Action hover background when the pointer is on it. A progress pointer when it is disabled during a request. | The one principal action of a page, for example "Log in with Spotify", or of one item in a list, for example "Publish" for one festival. |
| Header button | Brand background, 1px on-brand border, on-brand text, radius 8px. Colours change places when the pointer is on it. | A secondary action in the site header: "Log out". The border shows that it is a button, without the emphasis of the principal action. |
| Account | Display name, then the header button, at the right of the site header. A long display name ends with an ellipsis at 14rem. | Shows the logged-in account. On a narrow screen, it moves below the wordmark. |
| Notice | Surface background, 1px rule border, 4px strip in the problem colour on the left, radius 12px, no shadow, maximum width 36rem | A problem that stopped the last action of the user. The strip shows the state. |
| Confirmation notice | The notice, with the strip in the success colour | A completed action, for example "Added Download 2027". |
| Warning notice | The notice, with the strip in the warning colour | A completed action that the admin must check, for example a match with a genre warning. |
| Error summary | The notice, with a list of links to the fields | All problems of a form. It gets focus when the page opens. |
| Header link | On-brand text, underline | "Manage festivals" in the site header, for the admin only. |
| Secondary button | Surface background, 1px link border, link text, radius 8px. Selected background when the pointer is on it. | An action that is not the principal action of the page, for example "Get the lineup again", or "Search Clashfinder" after a search. |
| Input | Surface background, 1px muted border, radius 8px | Text fields and date fields. The muted border has 3:1 contrast for a control (WCAG 1.4.11). |
| Field with a problem | 4px strip in the problem colour on the left, the problem text above the input | Shows the field that needs a correction. The text also shows it without colour. |
| Festival panel | Surface background, 1px rule border, radius 12px, no shadow | One festival on Manage festivals. The festivals are separate items that the admin scans (LY-02). |
| Status label, badge | Badge background, ink text, radius 4px | A state ("Not published", "Your playlist is made", "New" after an artist name or a lineup name) or a Clashfinder mark ("Core page", "Official page") (DC-04). Not interactive, so no border and no pointer cursor. |
| Facts | Label and value pairs. Two columns from 40rem width, one column on a narrow screen. A value can have a second line: an action link ("Change the lineup source"), or one list of a lineup change, with 0.25rem above. | The facts of a festival, or of the artist on Spotify artist for one name. |
| Inline problem | 4px strip in the problem colour on the left, no background | A problem inside a panel, for example a failed lineup attempt. There is no panel in a panel. |
| Page choice | Surface background, 1px rule border, radius 12px. When it is chosen: 2px link border and selected background. | One Clashfinder page in the search results, or one MusicBrainz artist or "No match" in the artist choices. The full label selects the radio button. A fact does not break across two lines. |
| Lineup name item | 1px rule line above, no panel | One name on Admin: artist matches. The choices in it already have panels, so the item has no panel (no panel in a panel). |
| More choices | Native `details` element, summary in the link colour, no animation | The possible artists after the proposal. Closed by default. |
| Match list | 1px rule dividers, no radius. The "Change", "Set the Spotify artist" and "Show the predicted songs" links are at the right, or below the text on a narrow screen. | The artist matches of a festival. The rows are a list to scan, not separate items to compare. |
| Predicted song list | Numbered list without markers. The number is in a 2rem column, in the vertical centre of the player. 0.5rem between songs. Maximum width 40rem. | The predicted songs of one artist, in order (LY-06). A list marker cannot be in the vertical centre of a player. The list has `role="list"`, because Safari removes the list role when the markers are removed. |
| Spotify player | The Spotify embed player for one track in an iframe, full width of its column, 80px high, no border, radius 12px | Shows the song name and the artist, and plays the song. Spotify draws the content. On Predicted songs for one name, the iframe title gives the position, for example "Song 1 in the Spotify player". On the Festival page, it gives the artist, for example "Spotify player for Ghost". |
| Listen line | "Play the songs", then the links, on one line that wraps, 1rem between them, 0.375rem above | The supporting actions of one artist on the Festival page, under the genres. |
| Listen button | Surface background, 1px link border, link text, radius 8px, minimum height 2rem, weight 600. Selected background when the pointer is on it or the player is open. | "Play the songs" and "Close the player". Smaller than the secondary button, because a lineup has 150 of them and the interest levels are the principal task. `aria-expanded` gives the state. |
| Artist player | Under the listen line, 0.5rem above, maximum width 32rem: the Spotify player, then the song buttons and the position on one line | The open player of one artist on the Festival page. It is in the row, so it moves the rows below and covers nothing (QA-06). |
| Song button | The secondary button, 0.9375rem text, padding 0.25rem 0.75rem. Disabled: rule border, muted text. | "Previous song" and "Next song". The first song has no previous song, and the last song has no next song. |
| Visually hidden text | Not visible. Screen readers read it. | Makes repeated button labels specific, for example "Get the lineup again for Download 2027". |
| Link | Link colour, underline | Standard link. The underline shows that the text is a link. |
| Focus indicator | 3px solid outline, offset 2px | Shows keyboard focus on each interactive element (QA-03). |
| Browser icon | Brand square, radius 7/32, three bars in on-brand and focus-on-brand colours | Identifies the application in browser tabs (PB-04). The bars suggest an audio level meter. |

Shadows: the application uses no shadows in version 1. Dialogs get their role when a page first needs one.

Pointer states change only colours, with no transition, so they are not in the motion inventory.

## Motion inventory (IN-04, QA-05)

The application has no animation and no transition. The standards test fails when an element has an animation or a transition that is not in this inventory.

| Element | Animation | Purpose | Reduced motion |
|---|---|---|---|
| – | – | – | – |

When you add an animation, add a row to this table and the CSS selector to `motionInventory` in `test/e2e/standards.spec.ts`.

## Open questions

- Date fields: the browser shows a date field in the format of its interface language. A browser with an English (United States) interface shows mm/dd/yyyy. The application cannot change this. The browser always sends an ISO date, so the stored date is correct.

- Social-sharing images: the application is private and needs a log in. Users do not share its pages, so it has no social-sharing image. Record a question if this changes.
