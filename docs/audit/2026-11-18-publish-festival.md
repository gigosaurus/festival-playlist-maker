# Audit record: Publish a festival

| Item | Value |
|---|---|
| Date | 18 November 2026 |
| Change | Publish a festival (#9): the publish rule and the "Publish" action on Manage festivals; the published festivals on the Festivals page, with the complete festivals below the festivals to come; the Festival page with the title, the dates and the lineup |
| Pages in scope | Festivals (`/`): festivals to come, complete festivals. Festival (`/festivals/{id}`). Manage festivals (`/admin/festivals`): names without a match, ready to publish, published, not published. The pages from the previous record. |
| Auditor | Claude (AI assistant), for the change author |
| Release | No |
| Previous record | [2026-11-18-spotify-artists.md](2026-11-18-spotify-artists.md) |

Copy this record for the next audit. Change only the results that the new change affects, and update the evidence.

## Evidence sources

- **Standards test:** `test/e2e/standards.spec.ts`. It ran on 27 pages and page states, at desktop (1280 × 720) and mobile (Pixel 7) sizes. All checks passed.
- **Page tests:** `test/e2e/publish-festival.spec.ts`, and the page tests of the previous record. They include an axe WCAG 2.2 AA scan of Manage festivals before and after "Publish", of the Festivals page with and without complete festivals, and of the Festival page. The tests use the fake clock for the order of the festivals.
- **Module tests:** `test/modules/festivals.test.ts` (publish rule, no lineup, order of festivals to come and complete festivals, the last day, the date in the United Kingdom), and the earlier module tests.
- **Screenshots:** Manage festivals (names without a match, ready to publish, published), the Festivals page (with a complete festival, pointer on a festival) and the Festival page, at 1280 px and on Pixel 7. No page has horizontal scrolling at these widths.
- **Design decisions:** [docs/design-spec.md](../design-spec.md).

## Website acceptance criteria

### Purpose and information architecture

| ID | Result | Evidence |
|---|---|---|
| IA-01 | Pass | The first viewport of the Festivals page shows the title and the festivals. The first viewport of the Festival page shows the link back, the festival, the dates and the start of the lineup. |
| IA-02 | Pass | Page-to-task map in the design spec. The Festival page shows the lineup until #10 adds the interest levels. |
| IA-03 | Pass | The publish hint does not repeat the number of names without a match, because the Artist matches fact above it gives the number. The notice "did not publish" does not repeat the cause. |
| IA-04 | Pass | Festivals page: the festivals to come, then the complete festivals. Festival panel on Manage festivals: the facts, then "Publish" or the hint, then "Get the lineup again". |
| IA-05 | Pass | "Festivals" on the Festival page opens the Festivals page. Each festival link has the title of its Festival page. |
| IA-06 | Not applicable | The application has no offer, price or purchase. |

### Layout and composition

| ID | Result | Evidence |
|---|---|---|
| LY-01 | Pass | The Festivals page shows only the published festivals. The Festival page shows only the artists with an artist match. |
| LY-02 | Pass | Festival link panels: separate festivals that the user selects. The lineup is a list with dividers, not a card grid. |
| LY-03 | Not applicable | No grid areas of different sizes. |
| LY-04 | Pass | "Publish" is a filled button. "Get the lineup again" has only a border. The publish hint is muted. The section heading "Complete festivals" is smaller than the page title. |
| LY-05 | Pass | The complete festivals have 2.5rem space above their heading. The festival panels have 0.75rem between them (screenshots). |
| LY-06 | Not applicable | No numbered items. |

### Typography and colour

| ID | Result | Evidence |
|---|---|---|
| VS-01 | Pass | Typeface reason in the design spec. |
| VS-02 | Pass | The festival name in a festival link panel has its own type style. The publish hint and the lineup count use the supporting text style (type styles table). They agree with the rendered pages. |
| VS-03 | Pass | Headings change only size and weight. |
| VS-04 | Pass | Colour roles in the design spec. The festival name has the link colour, because the panel is a link. The first screenshot showed the name in ink, so the panel did not read as a link. It now has the link colour. |
| VS-05 | Pass | Standards test (axe colour contrast, no incomplete results) on each new page state. Link on Selected is 6.71:1 (design spec). |
| VS-06 | Pass | Standards test. Labels use sentence case. |

### Decoration and component styling

| ID | Result | Evidence |
|---|---|---|
| DC-01 | Pass | No new decoration. |
| DC-02 | Not applicable | No transparency or background blur. |
| DC-03 | Pass | The panel border groups one festival. The link border shows the pointer state. The rule lines separate the artists. Component roles table in the design spec. |
| DC-04 | Pass | The status label "Published" or "Not published" gives the state. |
| DC-05 | Pass | No new icons. |
| DC-06 | Pass | Component roles table: panels 12px, controls 8px, badges 4px. No shadows. |

### Written content

| ID | Result | Evidence |
|---|---|---|
| CT-01 | Pass | The publish hint names the condition. The confirmation names the page where users see the festival. |
| CT-02 | Not applicable | No promotional claims. |
| CT-03 | Pass | No text repeats an earlier text. |
| CT-04 | Pass | "Publish" publishes the festival. Each festival link opens its Festival page. "Festivals" opens the Festivals page (page tests). |
| CT-05 | Pass | British English. The dates use the same format on all pages. The terms agree with the glossary: published festival, lineup name, artist match. |
| CT-06 | Pass | Standards test. |

### Images and trust evidence

| ID | Result | Evidence |
|---|---|---|
| IM-01 to IM-06 | Not applicable | No images, testimonials or statistics. |

### Motion and interaction

| ID | Result | Evidence |
|---|---|---|
| IN-01 | Pass | Page tests use each control. |
| IN-02 | Pass | The festival link panel is a link, so its hover change is correct. The lineup rows and the status labels have no hover change. |
| IN-03 | Pass | No entrance animation. |
| IN-04 | Pass | Standards test. The motion inventory is still empty. |
| IN-05 | Not applicable | No counters, typing effects or transitions. |
| IN-06 | Pass | The Festival page has its own address. After "Publish", the application sends the browser to Manage festivals (status 303), so a refresh does not send the form again. |

### Functional completeness

| ID | Result | Evidence |
|---|---|---|
| FN-01 | Pass | The workflow completes in the page tests with the recorded production responses. |
| FN-02 | Pass | The notice after "Publish" reads the state of the festival from the database. A publish request for a festival with names without a match shows "did not publish" and does not publish it (page test). |
| FN-03 | Not applicable | No new form fields. |
| FN-04 | Pass | Empty: "There are no published festivals". Unavailable: the publish hint, without a lineup and with names without a match. Success: the notice after "Publish". Error: the notice "did not publish". Permission-restricted: a festival that is not published gives Page not found to users, and the publish form is in `/admin/`, which gives status 403 to a user who is not the admin. |
| FN-05 | Pass | The order of the festivals: module tests on three dates, and a page test with the fake clock. |
| FN-06 | Pass | The publication is in the database. |

### Responsive and accessible behaviour

| ID | Result | Evidence |
|---|---|---|
| QA-01 | Pass | Page tests at desktop and mobile sizes. On a narrow screen, the dates move below the festival name when the name is long. |
| QA-02 | Pass | A long festival name wraps in the panel (`overflow-wrap: anywhere`). |
| QA-03 | Pass | Page test: a user opens a festival with the keyboard only. The link panel has a visible outline. |
| QA-04 | Pass | No information or action is available only through hover. |
| QA-05 | Pass | Standards test with reduced motion set. |
| QA-06 | Pass | The header is not fixed. No overlays. |

### Consistency and publication

| ID | Result | Evidence |
|---|---|---|
| PB-01 | Pass | The dates have the same format on the Festivals page, the Festival page and Manage festivals. The notices use the notice component of the other pages. |
| PB-02 | Pass | The application name is the same on all pages. |
| PB-03 | Pass | Each festival link goes to `/festivals/{id}`. A festival that is not published gives Page not found (page test). |
| PB-04 | Pass | Standards test on each new page state. The Festival page has the festival as its title. |
| PB-05 | Pass | The new states are in the standards test and the axe scan. |
| PB-06 | Pass, with outstanding items | Release test record below. The outstanding items come from the previous record. |

## Additional content requirements

| ID | Result | Evidence |
|---|---|---|
| CP-01 | Pass | The publish hint answers "why can I not publish?". The confirmation answers "where do users see it?". |
| CP-02 | Pass | Direct wording. |
| CP-03 | Pass | "Published Download 2027" states the completed action. |
| CP-04 | Not applicable | No privacy assurances. |
| CP-05 | Pass | No reassurance. |
| CP-06 | Pass | No rhetorical devices. |
| CP-07 | Pass | No text explains the order of the festivals. The section heading "Complete festivals" shows it. Page briefs give the question that each text answers. |

## Editorial and design requirements

| ID | Result | Evidence |
|---|---|---|
| ED-01 | Pass | Page briefs in the design spec, including the new Festival page brief. |
| ED-02 | Pass | Page briefs: each explanation has its question. |
| ED-03 | Pass | Content tables in the design spec. |
| ED-04 | Pass | No implementation detail shows. The rule for complete festivals uses the date in the United Kingdom, and users see only the order. |
| ED-05 | Pass | The festival names have the link colour and the largest size in the list. "Publish" is a filled button. |
| ED-06 | Pass | Screenshots show one hierarchy of type, spacing, colour and component style. |
| ED-07 | Not applicable | No text was made shorter. |

## Release test record (PB-06)

| Check | Result |
|---|---|
| As the admin, add Download 2027. The panel shows "10 lineup names have no artist match" and the publish hint, with no "Publish" button. | Pass |
| Match all names except one. The panel shows "1 lineup name has no artist match" and no "Publish" button. | Pass |
| Match the last name. "Publish" shows. Select it. The notice "Published Download 2027" shows, and the label is "Published". | Pass |
| Send a publish request for a festival with names without a match. The festival stays not published, and the notice "did not publish" shows. | Pass |
| As a user, open the Festivals page. Only the published festivals show, with the year and the dates, the next festival first. | Pass |
| Set the fake clock after the last day of Slam Dunk 2027. Slam Dunk 2027 moves to "Complete festivals", below Download 2027. On its last day, it is still to come. | Pass |
| Open Download 2027 from the Festivals page with the pointer and with the keyboard. The Festival page shows the lineup without the names marked "no match". | Pass |
| Open the address of a festival that is not published. Page not found shows. | Pass |
| Look at the new states at 1280 px and on Pixel 7. Nothing overlaps or is cut off. | Pass. The first screenshot showed the festival names in ink. They now have the link colour. |

The auditor did the page checks with a browser that Playwright controlled, and examined the screenshots.

## Perception check (section 5, step 4)

Not done. A person who did not make the change must do it before the first release.

## Outstanding items

- The outstanding items from the previous record: the real Spotify log in as a user on the allowlist who is not the admin, and as a person who is not on the allowlist.
- Perception check by a person.
- The audit has no approver, because this is not a release.
