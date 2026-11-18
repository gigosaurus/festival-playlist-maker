import { html } from "hono/html";
import { layout } from "./layout.ts";

export function notFoundPage() {
  return layout({
    title: "Page not found",
    description: "The page at this address does not exist.",
    body: html`
      <h1>Page not found</h1>
      <p class="lead">The page at this address does not exist.</p>
      <p><a href="/">Show the festivals</a></p>
    `,
  });
}
