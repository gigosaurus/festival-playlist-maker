# Design specification

This file records the design decisions for Festival Playlist Maker. Some audit criteria in `STANDARDS.md` use these decisions as evidence. Update this file when you change a page, a type style, a colour role, a component role or an animation.

The styles are in `src/public/styles.css`. The CSS custom properties in that file have the same names as the roles in this file.

## Page-to-task map (IA-02)

| Page | Address | Principal task | Who | Status |
|---|---|---|---|---|
| Festivals | `/` | Choose a published festival | User | Empty state only (#3). The list design is part of #9. |
| Festival | – | Set interest levels for the lineup, then make or update the playlist | User | Planned (#10) |
| Admin: festival list | – | Add a festival and choose its lineup source | Admin | Planned (#6) |
| Admin: artist matches | – | Match each new lineup name, and check genre warnings | Admin | Planned (#7) |
| Page not found | Each unknown address | Find the correct page | User, admin | Done (#3) |

## Page briefs (ED-01, ED-03)

### Festivals

- **Principal task:** choose a published festival.
- **Who and from where:** a user on the allowlist. In version 1, the user comes from the Spotify log in (#4), from a bookmark or from the wordmark on a different page. The user knows the application and the festival that they go to.
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
| A link to log out, account details | Remove for now | #4 adds them with the log in. |
| An illustration in the empty state | Remove | It gives no information (DC-05, LY-01). |

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
| Label | – | 0.875rem | 600 | 1.4 | Ink | Reserved for form labels and status labels. Labels use sentence case, not uppercase (VS-06). |

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
| Link | `--colour-link` | #a3134f | Links, and the strip under the site header. Later: the principal action. |
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
| Focus on brand | Brand | 9.06:1 |

The application has only a light colour scheme in version 1. The standards test measures the contrast of the rendered pages.

## Component roles (DC-01, DC-03, DC-06)

| Component | Treatment | Role |
|---|---|---|
| Site header | Brand background, 4px strip in the link colour at the bottom, no radius, no shadow | Visual identity. The strip separates the header from the page. It is not interactive. |
| Content column | Maximum width 60rem, side padding 1rem (2rem from 40rem width) | Keeps the header and the page content aligned, and keeps lines at a legible length. |
| Empty-state panel | Surface background, 1px rule border, radius 12px (`--radius-panel`), no shadow, maximum width 36rem | Groups the empty-state message, so that it reads as a state of the page and not as a section. |
| Festival list (temporary) | 1px rule dividers, no radius | A plain list until #9 designs the festival list. |
| Link | Link colour, underline | Standard link. The underline shows that the text is a link. |
| Focus indicator | 3px solid outline, offset 2px | Shows keyboard focus on each interactive element (QA-03). |
| Browser icon | Brand square, radius 7/32, three bars in on-brand and focus-on-brand colours | Identifies the application in browser tabs (PB-04). The bars suggest an audio level meter. |

Shadows: the application uses no shadows in version 1. Buttons, inputs and dialogs get their roles when a page first needs them.

## Motion inventory (IN-04, QA-05)

The application has no animation and no transition. The standards test fails when an element has an animation or a transition that is not in this inventory.

| Element | Animation | Purpose | Reduced motion |
|---|---|---|---|
| – | – | – | – |

When you add an animation, add a row to this table and the CSS selector to `motionInventory` in `test/e2e/standards.spec.ts`.

## Open questions

- Social-sharing images: the application is private and needs a log in (#4). Users do not share its pages, so it has no social-sharing image. Record a question if this changes.
