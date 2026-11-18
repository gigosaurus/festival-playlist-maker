# Prefer the festival app API as the lineup source

Festival apps usually get lineup changes before the festival websites do, and they give days, stages and set times. For each festival, the application therefore uses the API of the official festival app when it is possible. It uses Clashfinder as the fallback. These APIs are not documented, so each one needs its own discovery, and a festival can change its API at any time.

## Considered Options

- Festival websites: Download and Bloodstock have clean HTML, but the Slam Dunk lineup is only in images. The websites also get changes later than the apps.
- Clashfinder only: the pages are made by users. Many festivals have duplicate pages, and the names of the pages are not consistent (for example "DLXXIV" for Download).
