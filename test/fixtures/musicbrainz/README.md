# Recorded MusicBrainz responses

The artist match tests use these responses. When the MusicBrainz API changes, record new responses with `record.ts`. Then the tests show which part of the application must change.

| File | Request | Recorded |
|---|---|---|
| `genres.txt` | `GET https://musicbrainz.org/ws/2/genre/all?fmt=txt` (2,226 genres) | 18 November 2026 |
| `search-<text>.json` | `GET https://musicbrainz.org/ws/2/artist?query=<text>&limit=5&fmt=json`, the address that `musicbrainzSearchUrl` makes | 18 November 2026 |

The search texts are the 10 names of the Download 2027 lineup in `test/fixtures/clashfinder/event-download27.json`, and "Ghost" and "BMTH". `search-symbols.json` is the search for "???".

To record again, from the repository root:

```sh
node --env-file-if-exists=.env test/fixtures/musicbrainz/record.ts test/fixtures/musicbrainz "???" "Blink 182" "Bring Me The Horizon" "Evanescence" "Faith No More" "Mötley Crüe" "Parkway Drive" "Pierce The Veil" "The Prodigy" "Turnstile" "Ghost" "BMTH"
```

The script needs `MUSICBRAINZ_CONTACT`. It waits 2 seconds between requests and sends a request again after status 503.

The search results change when people edit MusicBrainz. After a new recording, some expected values in the tests can change, for example the order of the genres.

`test/support/musicbrainz.ts` contains the recorded status 503 response. It is short, so it is not in a separate file.
