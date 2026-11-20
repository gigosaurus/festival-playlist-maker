# Recorded Spotify responses

The Spotify artist tests and the predicted song tests use these responses. When the Spotify Web API changes, record new responses with `record.ts`. Then the tests show which part of the application must change.

| File | Request | Recorded |
|---|---|---|
| `artist-<Spotify ID>.json` | `GET https://api.spotify.com/v1/artists/<Spotify ID>`, the address that `spotifyArtistUrl` makes | 18 November 2026 |
| `search-<text>.json` | `GET https://api.spotify.com/v1/search?q=<text>&type=artist&limit=5`, the address that `spotifySearchUrl` makes | 18 November 2026 |
| `tracks-<query>.json` | `GET https://api.spotify.com/v1/search?q=<query>&type=track&limit=10`, the address that `spotifyTrackSearchUrl` makes. `track-searches.json` gives the query of each file. | 19 November 2026 |

The artists are the Spotify links in `test/fixtures/musicbrainz/links-*.json` (`spotifyIds` in `test/support/spotify.ts`). The searches are for the two MusicBrainz artists without a Spotify link: "Ghost" and "Bring Me the Horizon UK". The app was in Development Mode, so the artists have no popularity, followers or genres.

To record again, from the repository root:

```sh
node --env-file-if-exists=.env test/fixtures/spotify/record.ts data/festival-playlist-maker.sqlite test/fixtures/spotify
```

The script needs a database in which the admin logged in, and `SPOTIFY_CLIENT_ID` and `ADMIN_SPOTIFY_USER_ID`. It uses the refresh token of the admin. When Spotify gives a new refresh token, the script writes it to the database. It waits 2 seconds between requests.

The search results change when Spotify changes its ranking. After a new recording, some expected values in the tests can change.

The track searches are the searches of a calculation of the predicted songs of Bring Me the Horizon, of the Japanese band "Ghost" and of Rage Against the Machine (`predictedArtists` in `test/support/spotify.ts`), and the searches in `coverSearches` (#14). The calculation uses the recorded setlist.fm responses, at the time of that recording. To record them again, from the repository root:

```sh
node --env-file-if-exists=.env test/fixtures/spotify/record-tracks.ts data/festival-playlist-maker.sqlite test/fixtures/spotify
```

The script has the same needs as `record.ts`. Record the setlist.fm responses first, because the searches come from the setlists (`test/fixtures/setlist-fm/README.md`). The script uses the Spotify name of each artist in the queries, and shows a name that is different from `predictedArtists`.

To record only the responses that have no file, add `--new` to either script. The other recorded responses then do not change, so the expected values in the tests stay correct:

```sh
node --env-file-if-exists=.env test/fixtures/spotify/record.ts --new data/festival-playlist-maker.sqlite test/fixtures/spotify
node --env-file-if-exists=.env test/fixtures/spotify/record-tracks.ts --new data/festival-playlist-maker.sqlite test/fixtures/spotify
```

Some responses are not recordings, because a test cannot cause them safely on the real API: the token response (`test/support/test-settings.ts`), and the status 404 response, the status 429 responses and the quota error (`test/support/spotify.ts`). They have the shapes of the Spotify Web API reference.
