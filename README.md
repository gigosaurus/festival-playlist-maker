# Festival Playlist Maker

Festival Playlist Maker makes a Spotify playlist from the lineup of a festival. The specification is in issue #1. The terms are in [GLOSSARY.md](GLOSSARY.md), and the decisions are in [docs/adr/](docs/adr/).

## Configuration

The application gets its Spotify settings from a `.env` file in the repository root. Git and Docker do not copy this file. Make the file on each computer that runs the application:

```sh
SPOTIFY_CLIENT_ID=<client ID>
ADMIN_SPOTIFY_USER_ID=<Spotify user ID>
```

|Variable|Value|
|-|-|
|`SPOTIFY_CLIENT_ID`|The client ID of the Spotify developer app. It is in the Spotify Developer Dashboard, at *Settings → Basic Information*.|
|`ADMIN_SPOTIFY_USER_ID`|The Spotify user ID of the admin. It is the *Username* at spotify.com/account/overview. The display name is not the user ID.|

The application does not use the client secret (ADR-0001). Do not put the client secret in the .env file or in the repository.

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
