# Choose songs from setlist.fm, not from Spotify

Spotify removed artist top tracks and track popularity for Development Mode apps in 2026 (see ADR-0001). The application therefore chooses the songs for each artist from recent setlists on setlist.fm, and finds each song on Spotify. These are also the songs that the user will probably hear at the festival.

## Considered Options

- Spotify search for `artist:"Name"`: one request for each artist, but the sort order is not documented.
- The most recent album of the artist: easy, but it does not show what the artist plays live.

## Consequences

- Each song needs a Spotify search request, so the application makes more Spotify requests than with top tracks.
- The setlist.fm API key permits a maximum of 2 requests each second and 1,440 requests each day. A calculation sends 1 to 10 requests for each artist, so a lineup of 150 artists can need more than one day. When the application reaches 1,440 requests in 24 hours, the calculation waits.
- setlist.fm has no festival field (#13). A show is a festival set when MusicBrainz has an event of type "Festival" for the artist on the date, or when setlist.fm has 10 or more artists at the venue on the date. Each source finds festivals that the other does not find. setlist.fm often has a venue for each stage of a festival, for example "Mainstage 01" at Hellfest, so its count is low. MusicBrainz has many European festivals, but fewer festivals in other countries. For the recorded shows of Bring Me the Horizon, setlist.fm found 9 and MusicBrainz found 11 of approximately 21 festival sets. Together they found 16.
- The MusicBrainz events of an artist need 1 request for each 100 events. For each other show in the look-back period, the application sends 1 more setlist.fm request. An artist with many shows needs approximately 45 more setlist.fm requests for its first calculation. The application stores the result for each venue and date, so artists at the same festival share it, and a recalculation does not send these requests again. The first calculation of a large lineup can therefore need several days.
- The store keeps only the setlist.fm venue ID, the date and "festival set or not" for each venue and date. It keeps no setlists and no artist names.
- The setlist.fm terms permit only non-commercial use, require an attribution link and do not permit storage of setlist data beyond short-term caching.
