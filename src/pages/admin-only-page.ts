import { html } from "hono/html";
import type { User } from "../sessions.ts";
import { layout } from "./layout.ts";

// The permission-restricted state for a user who is not the admin (FN-04).
export function adminOnlyPage(user: User) {
  return layout({
    title: "Only the admin can open this page",
    description: "This page is for the admin of Festival Playlist Maker.",
    user,
    body: html`
      <h1>Only the admin can open this page</h1>
      <p class="lead">Your Spotify account does not have the admin role.</p>
      <p><a href="/">Show the festivals</a></p>
    `,
  });
}
