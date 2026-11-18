# Stay in Spotify Development Mode

Spotify gives extended quota only to registered organisations with 250,000 or more monthly active users (since 15 May 2025). The application is a personal tool, so it stays in Development Mode. Development Mode permits the app owner and a maximum of 5 allowlisted users, and the app owner must have Spotify Premium. Development Mode also removes endpoints, for example artist top tracks and batch requests (February 2026), and it has a lower rate limit and an unpublished quota.

## Consequences

- The application cannot have more users than the owner and 4 friends. A public release needs a different design.
- Each Spotify request gets one item, so the application must cache Spotify IDs and pace its requests.
