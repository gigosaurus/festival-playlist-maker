# Recorded setlist.fm responses

The predicted song tests use these responses. When the setlist.fm API changes, record new responses with `record.ts`. Then the tests show which part of the application must change.

| File | Request | Recorded |
|---|---|---|
| `setlists-<MusicBrainz ID>-<page>.json` | `GET https://api.setlist.fm/rest/1.0/artist/<MusicBrainz ID>/setlists?p=<page>`, the address that `setlistFmSetlistsUrl` makes | 19 November 2026 at 13:13 UTC |
| `venue-<venue ID>-<YYYY-MM-DD>.json` | `GET https://api.setlist.fm/rest/1.0/search/setlists?venueId=<venue ID>&date=<dd-MM-yyyy>`, the address that `setlistFmVenueSetlistsUrl` makes | 19 November 2026 at 15:34 UTC |

Each file contains the status and the body of the response.

| Artist | MusicBrainz ID | Pages | Case |
|---|---|---|---|
| Bring Me the Horizon | `074e3847-f67f-49f9-81f1-8c8cea147e8e` | 1 to 3 | An artist with many recent shows. Page 3 has the first show before the look-back period. It has festival sets and a long tour (issue #13). |
| Ghost (the Japanese band) | `97ea6a8e-2011-45f0-895e-8bb082b1aa64` | 1 | An artist with setlists only from 2009, so it has no setlists in the look-back period. |
| Bring Me the Horizon UK | `aa6d8208-d68b-4b7a-83ea-7faaebccf12b` | 1 | An artist that setlist.fm has no setlists of. setlist.fm gives status 404. |

To record again, from the repository root:

```sh
node --env-file-if-exists=.env test/fixtures/setlist-fm/record.ts test/fixtures/setlist-fm 074e3847-f67f-49f9-81f1-8c8cea147e8e 97ea6a8e-2011-45f0-895e-8bb082b1aa64 aa6d8208-d68b-4b7a-83ea-7faaebccf12b
```

The script needs `SETLIST_FM_API_KEY`. It waits 2 seconds between requests. It gets the pages that a calculation at the time of the recording gets. Then it gets the venue-and-date search for each show that the calculation checks.

The venue-and-date searches are for the 55 shows of Bring Me the Horizon in the look-back period. 9 of them have 10 or more artists: Reading, Leeds, Louder Than Life, Rock for People, Tons of Rock, Provinssi, Tuska, Sziget and Furnace Fest. setlist.fm has a venue for each stage of some festivals, for example "Mainstage 01" at Hellfest. These venues have fewer than 10 artists on one date. The application finds some of these festival sets from the MusicBrainz events (`test/fixtures/musicbrainz/README.md`). A calculation does not send the searches for MusicBrainz festival days, but the files are kept for the tests of the setlist.fm module.

To record only the venue-and-date searches for the recorded pages, at the time of their recording, add `--venues`:

```sh
node --env-file-if-exists=.env test/fixtures/setlist-fm/record.ts --venues test/fixtures/setlist-fm 074e3847-f67f-49f9-81f1-8c8cea147e8e
```

After a new recording, do these steps:

1. Change `setlistFmRecordedAt` in `test/support/setlist-fm.ts` to the time that the script shows. The tests set the fake clock to this time.
2. Record the Spotify track searches again (`test/fixtures/spotify/README.md`), because the songs and their order change.
3. Change the expected track IDs in `test/modules/predicted-songs.test.ts` and `test/e2e/admin-predicted-songs.spec.ts`.
4. Change the venues, the dates and the festival sets in `test/modules/predicted-songs.test.ts`. Record the MusicBrainz events again at the same time.

The setlist.fm terms permit only short-term caching of setlist.fm data. These files are test data. The application does not store setlist.fm data (ADR-0002).

The status 429 response in `test/support/setlist-fm.ts` is not a recording. The setlist.fm documentation does not give the response to a request over the rate limit, and a test cannot cause one safely.
