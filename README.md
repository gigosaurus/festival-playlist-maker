# Festival Playlist Maker

Festival Playlist Maker makes a Spotify playlist from the lineup of a festival. The specification is in issue #1. The terms are in [GLOSSARY.md](GLOSSARY.md), and the decisions are in [docs/adr/](docs/adr/).

## Configuration

The application gets its Spotify, Clashfinder and MusicBrainz settings from a `.env` file in the repository root. Git and Docker do not copy this file. Make the file on each computer that runs the application:

```sh
SPOTIFY_CLIENT_ID=<client ID>
ADMIN_SPOTIFY_USER_ID=<Spotify user ID>
CLASHFINDER_USERNAME=<Clashfinder username>
CLASHFINDER_PRIVATE_KEY=<Clashfinder private key>
MUSICBRAINZ_CONTACT=<email address or web address>
```

|Variable|Value|
|-|-|
|`SPOTIFY_CLIENT_ID`|The client ID of the Spotify developer app. It is in the Spotify Developer Dashboard, at *Settings → Basic Information*.|
|`ADMIN_SPOTIFY_USER_ID`|The Spotify user ID of the admin. It is the *Username* at spotify.com/account/overview. The display name is not the user ID.|
|`SPOTIFY_REDIRECT_URI`|Optional. The address to which Spotify sends the browser after the log in. The default is `http://127.0.0.1:3000/log-in/callback`. On a server, use the HTTPS address of the application, for example `https://playlists.your-domain/log-in/callback`.|
|`CLASHFINDER_USERNAME`|The username of the Clashfinder account of the admin. It is the username that you use to log in at clashfinder.com. The account password is not necessary.|
|`CLASHFINDER_PRIVATE_KEY`|The private key of the Clashfinder account. Log in to Clashfinder. Then open clashfinder.com/pages/api. The page shows the private key.|
|`MUSICBRAINZ_CONTACT`|An email address or a web address of the admin. Each MusicBrainz request sends it in the User-Agent header, as the MusicBrainz API rules require. MusicBrainz uses it only to contact you when the application causes a problem. MusicBrainz can block an application that sends no contact.|

Add the redirect URI to the Spotify developer app, at *Settings → Basic Information → Redirect URIs*. The two values must be the same text. Spotify accepts an HTTP address only for a loopback address. Use `127.0.0.1`, not `localhost`.

Open the application at the same host as the redirect URI. If the host is different, the log in fails, because the browser keeps the log in values for each host.

The Spotify account that owns the developer app has the admin role. Add each other user to the app in the Spotify Developer Dashboard, at *User Management*. Spotify needs the name and the email address of the Spotify account of each user.

The application does not use the client secret (ADR-0001). Do not put the client secret in the .env file or in the repository.

Clashfinder is the fallback lineup source (ADR-0004, ADR-0006). Do not put the Clashfinder private key in the repository.

## Run in a container

Docker Compose builds the container and starts the application on port 3000:

```sh
docker compose up --build
```

The database file is on the `festival-playlist-maker_database` volume, at `/data/festival-playlist-maker.sqlite` in the container. The application creates or migrates the database schema when it starts.

## Run without a container

You need Node.js 26 or later. Node.js runs the TypeScript files directly, so there is no build step.

```sh
npm install
npm start
```

The database file is `data/festival-playlist-maker.sqlite`. Set `DATABASE_PATH` to use a different file, and `PORT` to use a different port.

## Tests

Install the Playwright browser once:

```sh
npx playwright install chromium
```

Then run all of the tests:

```sh
npm test
```

The test run has three parts:

- `npm run typecheck`: the TypeScript compiler checks the types.
- `npm run test:modules`: module tests with a real SQLite file in a temporary directory.
- `npm run test:e2e`: Playwright tests against the running application. They include the standards test (`test/e2e/standards.spec.ts`).

No test sends a request to an external service. The application gets its HTTP client and its clock by injection. The tests use `FakeHttpClient` and `FakeClock` from `test/support/`. In module tests, the global `fetch` function fails. In Playwright tests, the browser can load files only from the test server.

The Clashfinder tests use recorded Clashfinder responses in `test/fixtures/clashfinder/`. When the Clashfinder API changes, record the responses again. The README in that directory tells you how. The artist match tests use recorded MusicBrainz responses in `test/fixtures/musicbrainz/` in the same way.
