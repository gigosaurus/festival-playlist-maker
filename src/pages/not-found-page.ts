import { html } from "hono/html";
import type { User } from "../sessions.ts";
import { layout } from "./layout.ts";

export function notFoundPage(user: User) {
  return layout({
    title: "Page not found",
    description: "The page at this address does not exist.",
    user,
    body: html`
      <h1>Page not found</h1>
      <p class="lead">The page at this address does not exist.</p>
      <p><a href="/">Show the festivals</a></p>
    `,
  });
}
