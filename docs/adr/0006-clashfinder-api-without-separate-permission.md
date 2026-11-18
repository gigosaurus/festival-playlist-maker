# Use the Clashfinder API without separate permission

Clashfinder is the fallback lineup source (ADR-0004). Clashfinder publishes an API for exports in JSON and other formats (clashfinder.com/pages/api). The API page gives no terms of use, rate limits or attribution rules, and it does not tell users to ask for permission. Each request needs a Clashfinder account and its private key, so the maintainer controls access. The application therefore uses the API without separate permission from the maintainer.

Each export request needs `authUsername` and `authPublicKey`. The public key is an SHA-256 hash of the username, the private key and the optional parameters. A public key is therefore valid for only one set of optional parameters, for example `authValidUntil`. The application makes the public key from the username and the private key of the Clashfinder account of the admin. The username and the private key are in the `.env` file, not in the repository.

## Rules for the application

One person runs Clashfinder, and donations pay for it. The application therefore obeys these rules:

- Keep each lineup in the database. Get a lineup again only when the admin asks for it.
- Send one request at a time, with a pause between requests.
- When Clashfinder gives an error, stop and show the error to the admin. Do not try the request again automatically.

## Consequences

- If Clashfinder publishes terms or rate limits, the application must obey them, and this ADR needs a change.
- The application cannot start without `CLASHFINDER_USERNAME` and `CLASHFINDER_PRIVATE_KEY`.
