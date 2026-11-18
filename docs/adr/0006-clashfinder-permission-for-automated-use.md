# Use Clashfinder only with permission from the maintainer

Clashfinder is the fallback lineup source (ADR-0004). It has no published terms or rate limits, and one person runs it. The admin therefore asked the maintainer (halvin@clashfinder.com) for permission for automated use. The maintainer gave permission on PLACEHOLDER (date).

Since 20 June 2025, each export request needs `authUsername` and `authPublicKey`. The public key is an SHA-256 hash of the username, the private key and the optional parameters (clashfinder.com/pages/api). A public key is therefore valid for only one set of optional parameters, for example `authValidUntil`. The application makes the public key from the username and the private key of the Clashfinder account of the admin. The username and the private key are in the `.env` file, not in the repository.

## Conditions

PLACEHOLDER: record each condition that the maintainer gave, for example a rate limit, an attribution or the festivals that the application can export.

## Consequences

- The application obeys each condition above. A change to a condition needs a change to this ADR.
- The application cannot start without `CLASHFINDER_USERNAME` and `CLASHFINDER_PRIVATE_KEY`.
