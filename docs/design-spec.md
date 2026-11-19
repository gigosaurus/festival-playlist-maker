# Design specification

This file records the design decisions for Festival Playlist Maker. Some audit criteria in `STANDARDS.md` use these decisions as evidence. Update this file when you change a page, a type style, a colour role, a component role or an animation.

The styles are in `src/public/styles.css`. The CSS custom properties in that file have the same names as the roles in this file.

## Page-to-task map (IA-02)

| Page | Address | Principal task | Who | Status |
|---|---|---|---|---|
| Log in | `/log-in` | Log in with Spotify | A person who is not logged in | Done (#4) |
| Festivals | `/` | Choose a published festival | User | Done (#9) |
| Festival | `/festivals/{id}` | Set interest levels for the lineup, then make or update the playlist | User | Interest levels done (#10). #15 adds the playlist. |
| Manage festivals (Admin: festival list) | `/admin/festivals` | See each festival and the state of its lineup, get a lineup again, and publish a festival | Admin | Done (#6, #9) |
| Add a festival | `/admin/festivals/new` | Add a festival and choose its lineup source | Admin | Done (#6) |
| Admin: artist matches | `/admin/festivals/{id}/artist-matches` | Match each new lineup name, and check genre warnings and Spotify artists | Admin | Done (#7, #8) |
| Artist match for one name | `/admin/festivals/{id}/artist-matches/{lineup name id}` | Search MusicBrainz with a different text, or change a match | Admin | Done (#7) |
| Spotify artist for one name | `/admin/festivals/{id}/artist-matches/{lineup name id}/spotify` | Set the Spotify artist of a match by hand | Admin | Done (#8) |
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
- **Supporting detail:** none. The playlist status of each festival (user story 8) comes with the playlist.

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

### Festival

- **Principal task:** set the interest level of each artist on the lineup. Later, make or update the playlist (#15).
- **Who and from where:** a user, from a festival on the Festivals page, or from a bookmark. The user knows the festival and some of its artists. The user usually sets the levels over several visits (user story 19).
- **Necessary before the task:** the festival, the artists on the lineup, the genres of each artist (user story 17), and the interest level of each artist.
- **Supporting detail:** the number of artists that the playlist will contain (user story 20). The search, the filter and the sort.

A lineup has approximately 150 artists, so one action sets a level (user story 14). Each artist has four radio buttons that look like segments. A selection saves the level immediately. With the keyboard, Tab moves from artist to artist, and the arrow keys change the level. Each level that the user sets is saved. A different user has different levels.

The application saves each change in the background, so the page shows no confirmation. When a save fails, the artist shows the level that the application saved last, and the problem under the artist (FN-02). The playlist count changes only after a save.

The search, the filter and the sort apply together (FN-05). The address keeps them, so that a reload and Back show the same list. A change of interest level does not hide or move an artist. Otherwise, the artist can leave the screen before the user can correct a mistake. When the list is out of date, the page tells the user and gives "Update the list" (CP-01: the user sees an artist that does not agree with the filter).

Without JavaScript, the radio buttons are one form, and "Save the interest levels" saves all of them. The search, the filter and the sort do not show, because they need the script.

Empty states: a search or a filter without results says which condition gave no artist, and gives "Show all artists".

| Content | Decision | Reason |
|---|---|---|
| Link "Festivals" above the title | Keep visible | The way back. It has the title of its destination (IA-05). |
| Page title "{festival} {year}" | Keep visible | Identifies the festival. It is the playlist name. |
| Dates | Keep visible | Identify the edition. |
| "The playlist will contain N of M artists." | Keep visible | User story 20. Artists at Not interested get no songs. #15 adds the number of songs and the action that makes the playlist. |
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
| The number of songs for each level | Remove until #15 | The playlist does not exist yet. |

### Manage festivals

- **Principal task:** see each festival and the state of its lineup. Start to add a festival. Publish a festival when its artist matches are complete.
- **Who and from where:** the admin, from the link "Manage festivals" in the site header, or after "Add the festival". The admin knows the festivals, Clashfinder and the `.env` file.
- **Necessary before the task:** the festivals, the dates, the lineup source, the number of lineup names and the time of the last lineup. When the last attempt failed: the time, the cause and if the festival kept its lineup.
- **Supporting detail:** the expected genres. The admin can check them before the artist matches (#7).

The admin asks "did Clashfinder give the lineup?" after each action. The notice at the top answers it from the database, not from the request (FN-02). A failure notice does not repeat the cause, because the festival below shows it (IA-03). The festival keeps the cause after a reload, so the notice is not the only place for it.

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
| Button "Get the lineup again" | Keep visible, secondary style | ADR-0006: the application gets a lineup again only when the admin asks. Hidden text names the festival for screen readers. |
| Empty-state text about publication | Remove | The empty page gives no reason to ask about publication (CP-07). The status label shows it for each festival. |
| Artist matches: number of names without a match, and a link | Keep visible, when the festival has a lineup | Tells the admin which festival needs work. The link opens Admin: artist matches. Hidden text names the festival for screen readers. |
| The lineup names | Remove | The Admin: artist matches page shows them (#7). |

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
| Supporting text | `.empty-state p`, `.festival-dates`, `.publication-hint`, `.lineup-count`, `.lineup-action` | 1rem | 400 | 1.5 | Muted | Text that explains or qualifies the text above it |
| Playlist count | `.playlist-count` | 1rem | 400 | 1.5 | Ink | "The playlist will contain N of M artists." on the Festival page. Ink, because it is information for a decision, not a qualification. |
| Artist name | `.artist-name` | 1rem | 650 | 1.5 | Ink | The lineup name of one artist on the Festival page |
| Artist genres | `.artist-genres` | 0.9375rem | 400 | 1.5 | Muted | The genres under the artist name |
| Interest level | `.level` | 0.9375rem | 400, 650 when chosen | 1.25 | Ink, Link when chosen | The label of one interest level. The weight and the colour show the chosen level together with the border. |
| Festival name in the festival list | `.festival-link .festival-name` | 1.125rem | 650 | 1.5 | Link | The festival name and year on the Festivals page. The link colour shows that the panel is a link. |
| Hint | `.hint`, `.choice-facts` | 0.9375rem | 400 | 1.5 | Muted | Text under a form label or a choice that helps the admin enter or choose a value |
| Label | `.label`, `.facts dt`, `.status-label`, `.badge` | 0.875rem | 600 | 1.4 | Ink | Form labels, fact names and status labels. Labels use sentence case, not uppercase (VS-06). |
| Field problem | `.field-problem` | 1rem | 600 | 1.5 | Problem | The problem of one form field and how to correct it, and a failed save of an interest level |
| Choice label | `.choice-label` | 1rem | 650 | 1.5 | Ink | The name of a Clashfinder page or a MusicBrainz artist in a list of choices |
| Lineup name heading | `.match-item-heading` | 1.125rem | 650 | 1.4 | Ink | One lineup name on Admin: artist matches. Smaller than a section heading, larger than a choice label. |
| Genre warning | `.genre-warning` | 0.9375rem | 600 | 1.5 | Warning | "Warning: none of the expected genres" and "Warning: no Spotify artist found". The text starts with "Warning", so the colour is not the only sign. |
| Matched lineup name | `.matched-lineup-name` | 1rem | 650 | 1.5 | Ink | The lineup name in the list of artist matches |
| Matched artist | `.matched-artist`, `.matched-spotify` | 0.9375rem | 400 | 1.5 | Muted | The artist of a match, with its facts, and its Spotify artist |
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
| Festival link panel | Surface background, 1px rule border, radius 12px, no shadow. The name at the left, the dates at the right, or below the name on a narrow screen. When the pointer is on it: selected background, link border, underlined name. Maximum width 40rem. | One published festival on the Festivals page. The full panel is one link to the Festival page (LY-02). |
| Complete festivals | Section heading, 2.5rem space above | Separates the complete festivals from the festivals to come. |
| Lineup list | 1px rule dividers, no radius, full column width. Each row: the name and the genres at the left, the interest levels at the right. Below 48rem width, the interest levels go below the name, with four equal columns. | The artists on the Festival page. The rows are a list to scan, not separate items to compare. |
| Interest levels | Four segments, each one a radio button that covers the segment. Surface background, 1px rule border, radius 8px, minimum height 2.75rem. Chosen: 2px link border, selected background, link text, weight 650. Pointer on it: selected background. Keyboard focus: the focus indicator around the segment. | The interest level of one artist. The chosen state is the same as the page choice (PB-01). Each segment is a large target for touch (WCAG 2.5.8). |
| Lineup tools | Search field, then two selects, on one row. On a narrow screen, the search field has its own row and the two selects share the next row. | Search, filter and sort on the Festival page. They show only when the script runs. |
| Publish button | The principal action button, in the festival panel above "Get the lineup again" | The principal action for one festival on Manage festivals. It shows only when the admin can publish the festival, so a page has few of them. |
| Principal action button | Link background, on-brand text, radius 8px (`--radius-control`), no border, no shadow. Action hover background when the pointer is on it. | The one principal action of a page, for example "Log in with Spotify", or of one item in a list, for example "Publish" for one festival. |
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
| Status label, badge | Badge background, ink text, radius 4px | A state ("Not published") or a Clashfinder mark ("Core page", "Official page") (DC-04). Not interactive, so no border and no pointer cursor. |
| Facts | Label and value pairs. Two columns from 40rem width, one column on a narrow screen. | The facts of a festival, or of the artist on Spotify artist for one name. |
| Inline problem | 4px strip in the problem colour on the left, no background | A problem inside a panel, for example a failed lineup attempt. There is no panel in a panel. |
| Page choice | Surface background, 1px rule border, radius 12px. When it is chosen: 2px link border and selected background. | One Clashfinder page in the search results, or one MusicBrainz artist or "No match" in the artist choices. The full label selects the radio button. A fact does not break across two lines. |
| Lineup name item | 1px rule line above, no panel | One name on Admin: artist matches. The choices in it already have panels, so the item has no panel (no panel in a panel). |
| More choices | Native `details` element, summary in the link colour, no animation | The possible artists after the proposal. Closed by default. |
| Match list | 1px rule dividers, no radius. The "Change" and "Set the Spotify artist" links are at the right, or below the text on a narrow screen. | The artist matches of a festival. The rows are a list to scan, not separate items to compare. |
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
