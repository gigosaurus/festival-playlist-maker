# Design specification

This file records the design decisions for Festival Playlist Maker. Some audit criteria in `STANDARDS.md` use these decisions as evidence. Update this file when you change a page, a type style, a colour role, a component role or an animation.

The styles are in `src/public/styles.css`. The CSS custom properties in that file have the same names as the roles in this file.

## Page-to-task map (IA-02)

| Page | Address | Principal task | Who | Status |
|---|---|---|---|---|
| Log in | `/log-in` | Log in with Spotify | A person who is not logged in | Done (#4) |
| Festivals | `/` | Choose a published festival | User | Empty state only (#3). The list design is part of #9. |
| Festival | – | Set interest levels for the lineup, then make or update the playlist | User | Planned (#10) |
| Manage festivals (Admin: festival list) | `/admin/festivals` | See each festival and the state of its lineup, and get a lineup again | Admin | Done (#6) |
| Add a festival | `/admin/festivals/new` | Add a festival and choose its lineup source | Admin | Done (#6) |
| Admin: artist matches | – | Match each new lineup name, and check genre warnings | Admin | Planned (#7) |
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
- **Supporting detail:** none at this time. #9 adds playlist status and the order of festivals that are complete.

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

### Manage festivals

- **Principal task:** see each festival and the state of its lineup. Start to add a festival.
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
| Status label "Not published" | Keep visible | Tells the admin that users do not see the festival. #9 adds "Publish". |
| Lineup source, with a link to the Clashfinder page | Keep visible | The admin can check the page that gives the lineup. |
| Lineup: number of names and time | Keep visible | Answers "did the application get the lineup, and when?". |
| Lineup problem: time, cause, "keeps its previous lineup" | Keep visible, after a failure only | User story 49. The admin decides to correct the source or to try again. |
| Expected genres | Supporting detail | Necessary for the genre warnings in #7. |
| Button "Get the lineup again" | Keep visible, secondary style | ADR-0006: the application gets a lineup again only when the admin asks. Hidden text names the festival for screen readers. |
| Empty-state text about publication | Remove | The empty page gives no reason to ask about publication (CP-07). The status label shows it for each festival. |
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
| Supporting text | `.empty-state p`, `.festival-dates` | 1rem | 400 | 1.5 | Muted | Text that explains or qualifies the text above it |
| Hint | `.hint`, `.choice-facts` | 0.9375rem | 400 | 1.5 | Muted | Text under a form label or a choice that helps the admin enter or choose a value |
| Label | `.label`, `.facts dt`, `.status-label`, `.badge` | 0.875rem | 600 | 1.4 | Ink | Form labels, fact names and status labels. Labels use sentence case, not uppercase (VS-06). |
| Field problem | `.field-problem` | 1rem | 600 | 1.5 | Problem | The problem of one form field and how to correct it |
| Choice label | `.choice-label` | 1rem | 650 | 1.5 | Ink | The name of a Clashfinder page in the search results |
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
| Link | `--colour-link` | #a3134f | Links, the strip under the site header, and the background of the principal action button |
| Action hover | `--colour-action-hover` | #85103f | Background of the principal action button when the pointer is on it |
| Problem | `--colour-problem` | #b42318 | The strip on a notice or a field with a problem, and the text of a field problem |
| Success | `--colour-success` | #1e7b4a | The strip on a confirmation notice. Not used for text. |
| Selected | `--colour-selected` | #f9eef2 | Background of the chosen Clashfinder page, and of a secondary button when the pointer is on it |
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
| On brand (header link) | Brand | 15.80:1 |

The application has only a light colour scheme in version 1. The standards test measures the contrast of the rendered pages.

## Component roles (DC-01, DC-03, DC-06)

| Component | Treatment | Role |
|---|---|---|
| Site header | Brand background, 4px strip in the link colour at the bottom, no radius, no shadow | Visual identity. The strip separates the header from the page. It is not interactive. |
| Content column | Maximum width 60rem, side padding 1rem (2rem from 40rem width) | Keeps the header and the page content aligned, and keeps lines at a legible length. |
| Empty-state panel | Surface background, 1px rule border, radius 12px (`--radius-panel`), no shadow, maximum width 36rem | Groups the empty-state message, so that it reads as a state of the page and not as a section. |
| Festival list (temporary) | 1px rule dividers, no radius | A plain list until #9 designs the festival list. |
| Principal action button | Link background, on-brand text, radius 8px (`--radius-control`), no border, no shadow. Action hover background when the pointer is on it. | The one principal action of a page, for example "Log in with Spotify". |
| Header button | Brand background, 1px on-brand border, on-brand text, radius 8px. Colours change places when the pointer is on it. | A secondary action in the site header: "Log out". The border shows that it is a button, without the emphasis of the principal action. |
| Account | Display name, then the header button, at the right of the site header. A long display name ends with an ellipsis at 14rem. | Shows the logged-in account. On a narrow screen, it moves below the wordmark. |
| Notice | Surface background, 1px rule border, 4px strip in the problem colour on the left, radius 12px, no shadow, maximum width 36rem | A problem that stopped the last action of the user. The strip shows the state. |
| Confirmation notice | The notice, with the strip in the success colour | A completed action, for example "Added Download 2027". |
| Error summary | The notice, with a list of links to the fields | All problems of a form. It gets focus when the page opens. |
| Header link | On-brand text, underline | "Manage festivals" in the site header, for the admin only. |
| Secondary button | Surface background, 1px link border, link text, radius 8px. Selected background when the pointer is on it. | An action that is not the principal action of the page, for example "Get the lineup again", or "Search Clashfinder" after a search. |
| Input | Surface background, 1px muted border, radius 8px | Text fields and date fields. The muted border has 3:1 contrast for a control (WCAG 1.4.11). |
| Field with a problem | 4px strip in the problem colour on the left, the problem text above the input | Shows the field that needs a correction. The text also shows it without colour. |
| Festival panel | Surface background, 1px rule border, radius 12px, no shadow | One festival on Manage festivals. The festivals are separate items that the admin scans (LY-02). |
| Status label, badge | Badge background, ink text, radius 4px | A state ("Not published") or a Clashfinder mark ("Core page", "Official page") (DC-04). Not interactive, so no border and no pointer cursor. |
| Facts | Label and value pairs. Two columns from 40rem width, one column on a narrow screen. | The facts of a festival. |
| Inline problem | 4px strip in the problem colour on the left, no background | A problem inside a panel, for example a failed lineup attempt. There is no panel in a panel. |
| Page choice | Surface background, 1px rule border, radius 12px. When it is chosen: 2px link border and selected background. | One Clashfinder page in the search results. The full label selects the radio button. A fact does not break across two lines. |
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
