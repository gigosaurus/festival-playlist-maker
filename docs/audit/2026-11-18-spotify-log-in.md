# Audit record: log in with Spotify

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Log in with Spotify (#4): log in, sessions, log out, allowlist message, admin role, permission-restricted states |
| Pages in scope | Log in (`/log-in`) in four states. Festivals (`/`), empty state, now with the account area. Page not found. Only the admin can open this page (each address in `/admin/`). |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-walking-skeleton.md](2026-11-18-walking-skeleton.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on the seven pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/festivals-page.spec.ts` and `test/e2e/log-in.spec.ts`. They include an axe WCAG 2.2 AA scan of each page and state. The log in tests use the fake HTTP client for Spotify and a fake Spotify authorisation page.
- **Module tests:** `test/modules/spotify-log-in.test.ts` and `test/modules/sessions.test.ts`.
- **Screenshots:** each page and state at 360, 768 and 1440 px width, keyboard focus on both buttons, and the pointer on "Log out". At 360 px, the account area moves below the wordmark, and a display name of 40 characters ends with an ellipsis. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of each page shows the wordmark and a page title. The Log in page tells a first-time visitor what the application does. The empty state, Page not found and Only the admin can open this page state the cause. |
| IA-02 | Pass | Page-to-task map in the design spec. |
| IA-03 | Pass | Each page has one section. On the Log in page, a problem notice replaces the description, so no content repeats. |
| IA-04 | Pass | Festivals: page title, then the state of the list. Page not found and Only the admin can open this page: result, cause, next action. Log in: title, description or problem, action. |
| IA-05 | Pass | The wordmark goes to the Festivals page, or to Log in when no user is logged in. The link "Show the festivals" goes to the page with the title "Festivals". |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The pages show only the actual content. The empty state has no filler content. |
| LY-02 | Not applicable | No card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | The page title is the largest text. The empty-state heading and the notice heading are second. "Log in with Spotify" is the only filled button. "Log out" has only a border, because it is a secondary action. |
| LY-05 | Pass | Screenshots at 360, 768 and 1440 px. All content is in the first viewport. |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. Screenshots show legible text at all widths. |
| VS-02 | Pass | Type styles table in the design spec agrees with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight, as the type styles table defines. |
| VS-04 | Pass | Colour roles in the design spec. The link colour is used for links, the focus indicator, the header strip and the principal action button. The problem colour is used only for the notice strip. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results). Ratios in the design spec, including the button states. |
| VS-06 | Pass | Standards test. No text uses uppercase with letter spacing. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | The only decoration is the brand band and its strip. Purpose: visual identity. It is not interactive and does not cover content. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | Header strip: visual identity and separation. Panel border and list dividers: grouping. Notice strip: problem state. Component roles table in the design spec. |
| DC-04 | Not applicable | No badges. |
| DC-05 | Pass | The browser icon is the only icon. It identifies the application in the browser tab. |
| DC-06 | Pass | Component roles table in the design spec. Panels have a 12px radius, and buttons have an 8px radius. No component has a shadow. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | Each sentence is specific to this application: published festivals, the admin, the allowlist, the admin role, the address that does not exist. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | No paragraph repeats a heading or a different paragraph. The not-on-allowlist notice has two paragraphs: the cause, then the action. |
| CT-04 | Pass | "Show the festivals" opens the Festivals page. "Log in with Spotify" opens Spotify. "Log out" ends the session (page tests). |
| CT-05 | Pass | British English. The terms agree with the glossary. Each page uses "log in" and "log out" in the same way. No dates, units or currencies show. |
| CT-06 | Pass | Standards test: no placeholder text and no HTML comments. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 | Not applicable | No informational images. |
| IM-02 | Not applicable | No images that show evidence. |
| IM-03 | Not applicable | No product screenshots. |
| IM-04 | Not applicable | No photographs or illustrations. |
| IM-05 | Not applicable | No testimonials, logos, awards or marks. |
| IM-06 | Not applicable | No statistics or performance claims. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | The wordmark and "Show the festivals" open the Festivals page. "Log in with Spotify" and "Log out" do their actions (page tests). |
| IN-02 | Pass | Only links and buttons have a pointer cursor. Only buttons change colour when the pointer is on them. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is empty, and the pages have no animation. |
| IN-05 | Not applicable | No counters, typing effects or transitions. |
| IN-06 | Pass | Each page is a normal server-rendered page with its own address. Page not found returns status 404, and the admin-only page returns status 403. After the log in, a direct link opens the page that it names (page test). Each problem state of the Log in page has its own address, so a refresh shows the same state. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The log in workflow completes in the page tests against the fake Spotify, and for the admin against the production Spotify service (release test record below). |
| FN-02 | Pass | The log in has no success message. The Festivals page and the account area show only after the application stored the user and the session. When Spotify refuses a request, no session starts (page test). |
| FN-03 | Not applicable | No form with input fields. |
| FN-04 | Pass | Permission-restricted: a person who is not logged in goes to Log in, and a user who is not the admin gets "Only the admin can open this page" (page tests). Error: not on the allowlist, cancelled and failed (page tests). Empty: Festivals page (page test). Loading is not applicable, because the server renders each page. #9 adds the festival list. |
| FN-05 | Not applicable | No search, filters, sorting or pagination. |
| FN-06 | Pass | The session stays for one year after the last use. A page test closes the browser context and opens a new one with the stored cookies. A module test opens the same database file again. The interface does not tell the user a period. |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. Screenshots at 360, 768 and 1440 px. |
| QA-02 | Pass | A display name of 40 characters ends with an ellipsis at 14rem and does not move "Log out" (screenshot at 360 px). |
| QA-03 | Pass | Page tests: Tab moves focus to the wordmark, "Log in with Spotify" and "Log out". Each one has a visible outline, and Enter does the action. Screenshots of focus on both buttons. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set: no animation runs. |
| QA-06 | Pass | The header is not fixed. No floating controls, banners or overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | All pages use the same layout and the same header from `src/pages/layout.ts`. The account area is the same on each page for a logged-in user. |
| PB-02 | Pass | The application name is the same in the title, the wordmark, the description and the icon. |
| PB-03 | Pass | Each link goes to `/` (page tests). Unknown addresses show Page not found. After the log in, only an address on this application can open, so a link cannot send the user to a different website (page test). |
| PB-04 | Pass | Standards test: title, description, language, browser icon. Social-sharing image: not applicable, because the application is private (design spec, open questions). |
| PB-05 | Pass | Page not found, Only the admin can open this page and each Log in state are in the standards test and the axe scan, with the same checks as the Festivals page. |
| PB-06 | Pass, with outstanding items | Release test record below. Two checks with the real Spotify service are not done. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The empty-state text tells the user what changes the page. The Page not found text gives the cause. The not-on-allowlist notice tells the person what the admin needs, to prevent a second request. |
| CP-02 | Pass | All statements use direct wording. |
| CP-03 | Not applicable | No confirmations. |
| CP-04 | Not applicable | No privacy assurances. The Spotify page shows the permission that the application asks for. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | Page briefs in the design spec give the question that each text answers, and the text that was removed. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables (keep visible, remove) in the design spec. |
| ED-04 | Pass | The allowlist and the admin role show as consequences for the person: who can use the application and whom to ask. Development Mode, tokens and PKCE do not show. |
| ED-05 | Pass | The page title and the principal action have the most emphasis. "Log out" has less emphasis than a principal action. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour, panel and button style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Open `/` with no session. The Log in page opens. | Pass |
| Log in with the fake Spotify. The Festivals page shows with the display name and "Log out". | Pass |
| Open a bookmark (`/no-such-page?from=bookmark`) with no session, then log in. The bookmark address opens. | Pass |
| Close the browser context and open a new one with the stored cookies. The user is still logged in. | Pass |
| Select "Log out". The Log in page opens. A copy of the old cookie does not open a session. | Pass |
| Log in as a person who is not on the allowlist. The notice gives the cause and tells the person to ask the admin. No session starts. | Pass |
| Cancel at the fake Spotify. The cancelled notice shows. | Pass |
| Log in as the configured admin account. `/admin/festivals` gives Page not found (there are no admin pages yet), not the admin-only page. | Pass |
| Log in as a different user. `/admin` and `/admin/festivals` give "Only the admin can open this page" with status 403. | Pass |
| Use only the keyboard to log in and log out. | Pass |
| Look at each page and state at 360, 768 and 1440 px. Nothing overlaps or is cut off, except the intended ellipsis on a long display name. | Pass |
| Log in with the real Spotify developer app as the admin. The application stores the account with the admin role and starts a session. `/admin/festivals` gives Page not found, not the admin-only page. | Pass. The project owner did this check on 18 November 2026 with `npm start`. |
| Log in with the real Spotify developer app as a user on the allowlist who is not the admin. `/admin/festivals` gives the admin-only page. | Not done. The project owner postponed it. |
| Log in with the real Spotify developer app as a person who is not on the allowlist. The not-on-allowlist notice shows. | Not done. The project owner postponed it. This check also confirms that Spotify Development Mode refuses the profile request with status 403. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- Log in with the real Spotify developer app as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
