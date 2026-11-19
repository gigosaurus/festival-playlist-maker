# Use the Download app API without separate permission

The festival app API is the preferred lineup source (ADR-0004). The Download app gets its lineup from the Appmiral API without a user account ([docs/lineup-sources/download-app.md](../lineup-sources/download-app.md)). The API is not documented. The information about it comes from the decompiled Android app.

No terms cover the app or its API. The app linked to terms at share.livenation.com/info/terms.html, but on 19 November 2026 that address gave status 404. The website terms (downloadfestival.co.uk/terms-conditions/) apply to the website only. They do not refer to scraping, automated access, reverse engineering or an API. Clause 7.2 permits personal, non-commercial use of the website content.

The application is a personal project. It sends only requests that the app also sends, with the same headers, to get data that the app shows to each user. The application therefore uses the API without separate permission from Live Nation or Appmiral.

## Rules for the application

- Send only the edition, stage and artist requests in the lineup source document, with the headers of the app.
- Do not send requests to `https://app.appmiral.com/function/` or to other endpoints of the app.
- Keep each lineup in the database. Get a lineup again only when the admin asks for it.
- Send one request at a time, with a pause between requests.
- When the API gives an error, stop and show the error to the admin. Do not try the request again automatically.
- Keep the `x-protect` value in the `.env` file as `DOWNLOAD_APP_KEY`, not in the repository.

## Consequences

- If Live Nation or Appmiral publishes terms that prohibit this use, or asks the project to stop, the application must stop, and this ADR needs a change. Clashfinder is the fallback lineup source.
- A new app version can change the `x-protect` value, the identifiers or the base address. Then the admin must get the new values from the app.
