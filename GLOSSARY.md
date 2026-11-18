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

**Expected genre**:
A genre that the admin expects at a festival. An artist match to an artist with no expected genre gets a warning.
_Avoid_: Festival genre, allowed genre

**Artist match**:
The connection between an artist name on a lineup and one MusicBrainz artist. A lineup name that has no artist is marked "no match".
_Avoid_: Mapping, link, resolution

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
A show on setlist.fm where 10 or more artists played at the same venue on the same date.
_Avoid_: Festival show, festival appearance

**Predicted songs**:
The songs that an artist will probably play at a festival, in order of probability. The application calculates them from recent setlists on setlist.fm.
_Avoid_: Top tracks, setlist, likely songs
