# Use the MusicBrainz ID as the artist identity

setlist.fm identifies artists by MusicBrainz ID, and MusicBrainz artists often have a link to their Spotify page and genre tags. The application therefore matches each lineup name to one MusicBrainz artist. It gets the setlist.fm artist from that ID, and the Spotify artist from the MusicBrainz link, or from a Spotify search when there is no link. One admin match then connects all three services.

## Considered Options

- Match each lineup name to Spotify and to setlist.fm separately: the admin does two matches for each artist, and the two matches can disagree.
