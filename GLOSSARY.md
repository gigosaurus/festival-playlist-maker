# Festival Playlist Maker

The application makes a Spotify playlist from the lineup of a festival. Each user can change how many songs of each artist the playlist contains.

## Language

**Festival**:
A music event that has a lineup.
_Avoid_: Event, gig, show

**Lineup**:
The artists that play at one festival.
_Avoid_: Bill, roster, line-up

**Lineup source**:
The service from which the application gets the lineup of one festival: the API of the festival app, the festival website or Clashfinder.
_Avoid_: Importer, scraper, feed

**Lineup check**:
One attempt to get the lineup of a festival from its lineup source. It records the new names and the removed names. The application does a lineup check of each published festival each day until the festival starts. The admin can also start one with "Get the lineup again".
_Avoid_: Refresh, sync, poll, import

**Expected genre**:
A genre that the admin expects at a festival. An artist match to an artist with no expected genre gets a warning.
_Avoid_: Festival genre, allowed genre

**Artist match**:
The connection between an artist name on a lineup and one MusicBrainz artist. A lineup name that has no artist is marked "no match".
_Avoid_: Mapping, link, resolution

**Spotify artist**:
The Spotify artist of one MusicBrainz artist. The application gets it from the MusicBrainz Spotify link, or from a Spotify search when there is no link. The admin can set it by hand.
_Avoid_: Spotify match, Spotify mapping

**Playlist**:
The one Spotify playlist that the application makes for one user and one festival. By default, it contains each artist on the lineup.
_Avoid_: Mix, tracklist

**Interest level**:
How much a user wants to hear an artist: Not interested, Curious, Keen or Must see. The interest level sets how many songs of the artist the playlist contains. Curious is the default.
_Avoid_: Rating, score, priority

**Admin**:
The user who adds festivals, makes artist matches and publishes festivals.
_Avoid_: Owner, moderator

**Published festival**:
A festival that users can see. The admin can publish a festival only when each name on its lineup has an artist match or is marked "no match".
_Avoid_: Live festival, active festival

**Festival set**:
A show on setlist.fm on a day of a MusicBrainz festival event of the artist, or a show where 10 or more artists played at the same venue on the same date.
_Avoid_: Festival show, festival appearance

**Album-focused show**:
A show where more than half of the songs come from one album that was released in the 12 months before the show. It counts 0.1, so that a new album does not fill the playlist.
_Avoid_: Album show, album tour

**Look-back period**:
The months before a calculation from which the application uses setlists for the predicted songs: 18 months. When an artist has fewer than 5 shows in this period, the period is 3 years, and then 5 years. A result from a longer period has the long look-back mark.
_Avoid_: Window, history, time range

**Predicted songs**:
The songs that an artist will probably play at a festival, in order of probability. The application calculates them from recent setlists on setlist.fm.
_Avoid_: Top tracks, setlist, likely songs
