# Run as one container with a SQLite database

The application has a maximum of 5 users (see ADR-0001), so it runs as one TypeScript (Node.js) container with a SQLite database file on a mounted volume. The daily lineup check runs in the same process. A database server would add operation work and gives no advantage at this size.
