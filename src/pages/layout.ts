import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { User } from "../sessions.ts";

export const applicationName = "Festival Playlist Maker";

type Content = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface PageOptions {
  // The page title, without the application name.
  title: string;
  description: string;
  // The logged-in user. A page for a person who is not logged in has no user.
  user?: User;
  body: Content;
}

export function layout({ title, description, user, body }: PageOptions): Content {
  return html`<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} – ${applicationName}</title>
    <meta name="description" content="${description}">
    <meta name="application-name" content="${applicationName}">
    <meta name="theme-color" content="#1c1626">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="stylesheet" href="/styles.css">
  </head>
  <body>
    <header class="site-header">
      <div class="column site-header-row">
        <a class="wordmark" href="/">${applicationName}</a>
        ${user ? account(user) : ""}
      </div>
    </header>
    <main class="column page">
      ${body}
    </main>
  </body>
</html>`;
}

// The Spotify display name shows which account is logged in, for example on a shared device.
function account(user: User) {
  return html`
    <form class="account" method="post" action="/log-out">
      <span class="account-name" data-external-text>${user.displayName}</span>
      <button class="header-button" type="submit">Log out</button>
    </form>
  `;
}
