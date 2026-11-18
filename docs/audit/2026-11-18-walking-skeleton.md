# Audit record: walking skeleton

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Walking skeleton (#3): container, database, test seams, standards test, Festivals page empty state, Page not found |
| Pages in scope | Festivals (`/`), empty state only. Page not found (each unknown address). |
| Auditor | Claude (AI assistant), for the change author |
| Release | No. This is the first record. It is the baseline for the next records. |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on both pages, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed. Each check also failed when a violation was added to the page for a short time, so the checks can find failures.
- **Page tests:** `test/e2e/festivals-page.spec.ts`. They include an axe WCAG 2.2 AA scan of both pages.
- **Screenshots:** both pages at 360, 768 and 1440 px width, and keyboard focus at 360 px. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of each page shows the wordmark and a page title. The empty state states the cause. The Page not found page states the cause and gives a link. |
| IA-02 | Pass | Page-to-task map in the design spec. |
| IA-03 | Pass | Each page has one section. No content repeats. |
| IA-04 | Pass | Order on the Festivals page: page title, then the state of the list. Order on Page not found: result, cause, next action. |
| IA-05 | Pass | The wordmark goes to the Festivals page. The link "Show the festivals" goes to the page with the title "Festivals". |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The pages show only the actual content. The empty state has no filler content. |
| LY-02 | Not applicable | No card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | The page title is the largest text. The empty-state heading is second. Supporting text is muted. |
| LY-05 | Pass | Screenshots at 360, 768 and 1440 px. All content is in the first viewport. |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. Screenshots show legible text at all widths. |
| VS-02 | Pass | Type styles table in the design spec agrees with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight, as the type styles table defines. |
| VS-04 | Pass | Colour roles in the design spec. The link colour is used only for links, the focus indicator and the header strip. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results). Ratios in the design spec. |
| VS-06 | Pass | Standards test. No text uses uppercase with letter spacing. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | The only decoration is the brand band and its strip. Purpose: visual identity. It is not interactive and does not cover content. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | Header strip: visual identity and separation. Panel border and list dividers: grouping. Component roles table in the design spec. |
| DC-04 | Not applicable | No badges. |
| DC-05 | Pass | The browser icon is the only icon. It identifies the application in the browser tab. |
| DC-06 | Pass | Component roles table in the design spec. Only the empty-state panel has a radius. No component has a shadow. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | Each sentence is specific to this application: published festivals, the admin, the address that does not exist. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | Each page has one paragraph. It does not repeat the heading. |
| CT-04 | Pass | "Show the festivals" opens the Festivals page (page test). |
| CT-05 | Pass | British English. The terms agree with the glossary. No dates, units or currencies show in the empty state. |
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
| IN-01 | Pass | The wordmark and "Show the festivals" open the Festivals page (page tests). |
| IN-02 | Pass | Only links have a pointer cursor. No element has a hover effect. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is empty, and the pages have no animation. |
| IN-05 | Not applicable | No counters, typing effects or transitions. |
| IN-06 | Pass | Each page is a normal server-rendered page with its own address. The 404 page returns status 404. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Not applicable | No principal workflow is complete yet. #4 to #16 add them. |
| FN-02 | Not applicable | No success messages. |
| FN-03 | Not applicable | No forms. |
| FN-04 | Pass | In this scope, the only applicable state is the empty state of the Festivals page (page test). The loading state is not applicable, because the server renders the page. #4 adds the permission-restricted state, and #9 adds the list. |
| FN-05 | Not applicable | No search, filters, sorting or pagination. |
| FN-06 | Not applicable | The interface does not save information yet. |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. Screenshots at 360, 768 and 1440 px. |
| QA-02 | Not applicable | No long data, images or translated content yet. |
| QA-03 | Pass | Page test: Tab moves focus to the wordmark, the outline is visible, and Enter opens the page. Screenshots of focus on the header and the page. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set: no animation runs. |
| QA-06 | Pass | The header is not fixed. No floating controls, banners or overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | Both pages use the same layout and the same header from `src/pages/layout.ts`. |
| PB-02 | Pass | The application name is the same in the title, the wordmark, the description and the icon. |
| PB-03 | Pass | Both links go to `/` (page tests). Unknown addresses show Page not found. |
| PB-04 | Pass | Standards test: title, description, language, browser icon. Social-sharing image: not applicable, because the application is private (design spec, open questions). |
| PB-05 | Pass | Page not found is in the standards test and the axe scan, with the same checks as the Festivals page. |
| PB-06 | Fail | Release test record below. A person did not use the rendered application. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The empty-state text tells the user what changes the page. The Page not found text gives the cause. |
| CP-02 | Pass | All statements use direct wording. |
| CP-03 | Not applicable | No confirmations. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | Page briefs in the design spec give the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables (keep visible, remove) in the design spec. |
| ED-04 | Pass | No implementation details on the pages. |
| ED-05 | Pass | The page title and the state have the most emphasis. No optional information exists. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and panel style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| Open `/` with an empty database. The empty state shows. | Pass |
| Open an unknown address. Page not found shows with status 404. Select "Show the festivals". The Festivals page opens. | Pass |
| Use only the keyboard: Tab to the wordmark, press Enter. The Festivals page opens. | Pass |
| Look at both pages at 360, 768 and 1440 px. Nothing overlaps or is cut off. | Pass |
| Start the application with only production dependencies, with a new database file. It creates the schema and serves the pages. | Pass |
| Build and start the container with `docker compose up --build` (Docker 29.9.3). The application runs as the `node` user, creates the database file on the volume and serves the pages. | Pass |
| Add a published festival, then remove and start the container again. The festival stays on the Festivals page. | Pass |
| Stop the container. The application stops on SIGTERM with exit code 0 in less than 1 second. | Pass |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots. A person did not do the checks by hand.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- A person uses the rendered application and completes the checks in the release test record (PB-06).
- Perception check by a person.
- The audit has no approver, because this is not a release.
