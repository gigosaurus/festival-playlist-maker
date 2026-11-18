# Choose songs from setlist.fm, not from Spotify

Spotify removed artist top tracks and track popularity for Development Mode apps in 2026 (see ADR-0001). The application therefore chooses the songs for each artist from recent setlists on setlist.fm, and finds each song on Spotify. These are also the songs that the user will probably hear at the festival.

## Considered Options

- Spotify search for `artist:"Name"`: one request for each artist, but the sort order is not documented.
- The most recent album of the artist: easy, but it does not show what the artist plays live.

## Consequences

- Each song needs a Spotify search request, so the application makes more Spotify requests than with top tracks.
- The setlist.fm terms permit only non-commercial use, require an attribution link and do not permit storage of setlist data beyond short-term caching.
