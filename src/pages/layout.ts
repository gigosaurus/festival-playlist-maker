import { html } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

export const applicationName = "Festival Playlist Maker";

type Content = HtmlEscapedString | Promise<HtmlEscapedString>;

export interface PageOptions {
  // The page title, without the application name.
  title: string;
  description: string;
  body: Content;
}

export function layout({ title, description, body }: PageOptions): Content {
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
      <div class="column">
        <a class="wordmark" href="/">${applicationName}</a>
      </div>
    </header>
    <main class="column page">
      ${body}
    </main>
  </body>
</html>`;
}
