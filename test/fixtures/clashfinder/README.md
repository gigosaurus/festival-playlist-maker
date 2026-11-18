# Recorded Clashfinder responses

The lineup source tests use these responses. When the Clashfinder API changes, record new responses with `record.sh`. Then the tests show which part of the application must change.

| File | Request | Recorded |
|---|---|---|
| `event-slamdunk2026.json` | `GET https://clashfinder.com/data/event/slamdunk2026.json` | 18 November 2026 |
| `event-download27.json` | `GET https://clashfinder.com/data/event/download27.json` | 18 November 2026 |
| `all.json` | `GET https://clashfinder.com/data/events/all.json` | 18 November 2026 |

Each request had the signed keys of a real Clashfinder account. In the export files, the value of `authUsername` is changed to `test-clashfinder-user`.

The real `all.json` has approximately 10,700 pages (4 MB). This file contains only these pages, with the recorded values:

- The Download, Slam Dunk and Bloodstock pages that start in 2025 or later.
- The pages that start from 9 to 14 June 2027.
- Two pages that have no start date.

`test/support/clashfinder.ts` contains the recorded error responses (status 401 and 404). They are short, so they are not in separate files.
