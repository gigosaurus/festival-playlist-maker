import { html } from "hono/html";
import { layout } from "./layout.ts";

// The reasons why the last log in did not complete.
export type LogInProblem = "not-on-allowlist" | "cancelled" | "failed";

export function isLogInProblem(value: string | undefined): value is LogInProblem {
  return value === "not-on-allowlist" || value === "cancelled" || value === "failed";
}

// `next` is the address that opens after the log in.
export function logInPage(problem: LogInProblem | undefined, next: string) {
  return layout({
    title: "Log in",
    description: "Log in with your Spotify account to make playlists from festival lineups.",
    body: html`
      <h1>Log in</h1>
      ${problem
        ? problemNotice(problem)
        : html`<p class="lead">The application makes a Spotify playlist from the lineup of a festival.</p>`}
      <form method="post" action="/log-in">
        ${next === "/" ? "" : html`<input type="hidden" name="next" value="${next}">`}
        <button class="button" type="submit">Log in with Spotify</button>
      </form>
    `,
  });
}

function problemNotice(problem: LogInProblem) {
  const { heading, text } = problems[problem];
  return html`
    <section class="notice" aria-labelledby="problem-heading">
      <h2 id="problem-heading">${heading}</h2>
      ${text.map((paragraph) => html`<p>${paragraph}</p>`)}
    </section>
  `;
}

const problems: Record<LogInProblem, { heading: string; text: string[] }> = {
  "not-on-allowlist": {
    heading: "Your Spotify account is not on the allowlist",
    text: [
      "Only the Spotify accounts that the admin adds to the allowlist can use this application.",
      "Ask the admin to add your account. Give the admin the name and the email address of your Spotify account. Then log in again.",
    ],
  },
  cancelled: {
    heading: "You cancelled the log in",
    text: ["To use the application, log in again and accept the request from Spotify."],
  },
  failed: {
    heading: "The log in did not complete",
    text: ["The application did not get your account from Spotify. Log in again. If the problem continues, tell the admin."],
  },
};
