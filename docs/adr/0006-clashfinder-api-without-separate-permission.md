# Use the Clashfinder API without separate permission

Clashfinder is the fallback lineup source (ADR-0004). Clashfinder publishes an API for exports in JSON and other formats (clashfinder.com/pages/api). The API page gives no terms of use, rate limits or attribution rules, and it does not tell users to ask for permission. Each request needs a Clashfinder account and its private key, so the maintainer controls access. The application therefore uses the API without separate permission from the maintainer.

Each export request needs `authUsername` and `authPublicKey`. The public key is an SHA-256 hash of the username, the private key and the optional parameters, in this order, with no separator, in hexadecimal. A request with this key got `"auth":{"result":"pass"}` on 18 November 2026. A public key is therefore valid for only one set of optional parameters, for example `authValidUntil`. The application makes the public key from the username and the private key of the Clashfinder account of the admin. The username and the private key are in the `.env` file, not in the repository.

## Rules for the application

One person runs Clashfinder, and donations pay for it. The application therefore obeys these rules:

- Keep each lineup in the database. Get a lineup again only when the admin asks for it, or for the daily lineup check.
- The daily lineup check (#17) sends a maximum of 1 request for each published festival each day, until the festival starts. One run sends a maximum of 5 requests, so that requests stay available for the admin in the limit below.
- Send one request at a time, with a pause between requests. The pause is 10 seconds, from `Crawl-delay: 10` in clashfinder.com/robots.txt.
- Send a maximum of 10 requests in 5 minutes. Since November 2026, each export response says: "Starting 31st March 2027, API requests will be limited to 10 per user or IP address in 5 minutes." The application refuses a request above this limit and tells the admin when to try again. It does not wait, because the wait can be some minutes.
- Keep the list of all Clashfinder pages (approximately 4 MB) for one hour, so that a second search does not send a request.
- When Clashfinder gives an error, stop and show the error to the admin. Do not try the request again automatically.

The HTTP client applies the keys, the pause and the limit (`src/http-client.ts`).

## Consequences

- The rule about the daily lineup check changed on 22 November 2026, for #17 (user story 47). Before, the application got a lineup only when the admin asked for it. Approximately 3 festivals are published at one time, so the check adds approximately 3 requests each day. A Clashfinder export is a small file, and the list of all pages is not necessary for a check.

- If Clashfinder publishes terms or rate limits, the application must obey them, and this ADR needs a change.
- The application cannot start without `CLASHFINDER_USERNAME` and `CLASHFINDER_PRIVATE_KEY`.
