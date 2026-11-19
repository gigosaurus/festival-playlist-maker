# Recorded Download app responses

These are responses from the API of the Download Festival app. [docs/lineup-sources/download-app.md](../../../docs/lineup-sources/download-app.md) describes the API. When the API changes, record new responses with `record.sh`. Then the tests show which part of the application must change.

`record.sh` needs `DOWNLOAD_APP_KEY` in the `.env` file. The key is the `x_Protect` string resource of the Android app. The lineup source document tells how to get it. Do not put the key in the repository.

| File | Request | Recorded |
|---|---|---|
| `edition.json` | `GET https://app.appmiral.com/api/v7/events/downloadfestival/editions/downloadfestival2026` | 19 November 2026 |
| `stages.json` | `GET .../editions/downloadfestival2026/stages?max_per_page=250` | 19 November 2026 |
| `artists-1.json` | `GET .../editions/downloadfestival2026/artists?include_related=true&max_per_page=250` | 19 November 2026 |
| `artists-2.json` | The `_links.next` address of `artists-1.json` | 19 November 2026 |

The files contain the recorded values, with one change: `edition.json` has a test value for `sns_topic_arn`, because the real value contains an AWS account number.

On 19 November 2026, the edition has 101 published artists and 284 deleted artists. Most published artists changed on 12 November 2026, but the edition dates are still 10 to 15 June 2026. No artist has a performance, so no file contains days, stages or set times for an artist. Record the responses again when the app shows the timetable.
