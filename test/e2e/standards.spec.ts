// The standards test (STANDARDS.md section 5, step 2). It checks each page in
// the pages list for colour contrast (VS-05), page metadata (PB-04), placeholder
// text (CT-06), uppercase labels (VS-06), animation (IN-04, QA-05) and
// contractions in interface text (STE-05).
//
// Add each new page and each new page state to the pages list.
// Text that comes from a lineup source or from Spotify (for example an artist
// name) is not interface text. Put it in an element with the attribute
// data-external-text, and the text checks ignore it.
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test, testUser } from "./fixtures.ts";

// `loggedIn`: the test logs in as a user who is not the admin before it opens the page.
const pages = [
  { name: "Log in page", path: "/log-in", loggedIn: false },
  { name: "Log in page, not on the allowlist", path: "/log-in?problem=not-on-allowlist", loggedIn: false },
  { name: "Log in page, cancelled", path: "/log-in?problem=cancelled", loggedIn: false },
  { name: "Log in page, failed", path: "/log-in?problem=failed", loggedIn: false },
  { name: "Festivals page, empty state", path: "/", loggedIn: true },
  { name: "Page not found", path: "/no-such-page", loggedIn: true },
  { name: "Admin page for a user who is not the admin", path: "/admin/festivals", loggedIn: true },
];

// The motion inventory in docs/design-spec.md. Each entry is a CSS selector for
// an element that can have an animation or a transition. It is empty: the
// application has no animation.
const motionInventory: string[] = [];

const templateNames = /vite|react app|next\.js|create-|starter|template|untitled|^document$|localhost/i;

const placeholderText =
  /lorem ipsum|\bTODO\b|\bFIXME\b|\bTBD\b|\bXXX\b|placeholder|example\.(com|org)|your (company|name|logo)|\{\{|\}\}|\bundefined\b|\bNaN\b|\[object Object\]/i;

const contraction =
  /\b[a-z]+n['’]t\b|\b[a-z]+['’](re|ve|ll|d|m)\b|\b(it|that|there|what|here|who|where|let|he|she)['’]s\b/i;

for (const { name, path, loggedIn } of pages) {
  test.describe(name, () => {
    if (loggedIn) {
      test.beforeEach(async ({ logIn }) => {
        await logIn(testUser);
      });
    }

    test("VS-05: text has sufficient colour contrast", async ({ page }) => {
      await page.goto(path);

      const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
      expect(results.violations, "Text with insufficient contrast").toEqual([]);
      // axe cannot measure some backgrounds, for example gradients and images.
      // Such text needs a check by a person, so the test fails.
      expect(results.incomplete, "Text with a background that axe cannot measure").toEqual([]);
    });

    test("PB-04: page metadata identifies the application", async ({ page, request }) => {
      await page.goto(path);

      const title = await page.title();
      expect(title).toMatch(/^.+ – Festival Playlist Maker$/);
      expect(title).not.toMatch(templateNames);

      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.length ?? 0, "The page needs a description").toBeGreaterThan(20);
      expect(description).not.toMatch(templateNames);

      await expect(page.locator("html")).toHaveAttribute("lang", "en-GB");

      const icon = await page.locator('link[rel="icon"]').getAttribute("href");
      expect(icon, "The page needs a browser icon").toBeTruthy();
      const iconResponse = await request.get(icon!);
      expect(iconResponse.ok()).toBe(true);
      expect(iconResponse.headers()["content-type"]).toMatch(/^image\//);
      expect(await iconResponse.text()).toContain("Festival Playlist Maker");
    });

    test("CT-06: the page has no placeholder text or generation comments", async ({ page }) => {
      await page.goto(path);

      for (const text of await interfaceText(page)) {
        expect(text, "Placeholder text").not.toMatch(placeholderText);
      }
      const comments = await page.evaluate(() => {
        const walker = document.createTreeWalker(document, NodeFilter.SHOW_COMMENT);
        const found: string[] = [];
        while (walker.nextNode()) found.push(walker.currentNode.nodeValue ?? "");
        return found;
      });
      expect(comments, "HTML comments in the published page").toEqual([]);
    });

    test("VS-06: no label has uppercase text with increased letter spacing", async ({ page }) => {
      await page.goto(path);

      const uppercaseLabels = await page.evaluate(() =>
        [...document.body.querySelectorAll<HTMLElement>("*")]
          .filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent!.trim()))
          .filter((element) => {
            const style = getComputedStyle(element);
            const spaced = parseFloat(style.letterSpacing) > 0;
            const text = element.innerText.trim();
            const uppercase = style.textTransform === "uppercase" || (/[A-Z]{4}/.test(text) && text === text.toUpperCase());
            return spaced && uppercase;
          })
          .map((element) => element.outerHTML.slice(0, 120)),
      );
      expect(uppercaseLabels).toEqual([]);
    });

    test("IN-04: each animation is in the motion inventory", async ({ page }) => {
      await page.goto(path);

      const unlisted = await page.evaluate((inventory) => {
        const listed = (element: Element) => inventory.some((selector) => element.matches(selector));
        const hasMotion = (element: Element) => {
          const style = getComputedStyle(element);
          const nonZero = (durations: string) => durations.split(",").some((duration) => parseFloat(duration) > 0);
          const animation = style.animationName !== "none" && nonZero(style.animationDuration);
          return animation || nonZero(style.transitionDuration);
        };
        return [...document.querySelectorAll("*")]
          .filter((element) => hasMotion(element) && !listed(element))
          .map((element) => element.outerHTML.slice(0, 120));
      }, motionInventory);
      expect(unlisted, "Elements with an animation that is not in the motion inventory").toEqual([]);
    });

    test("QA-05: no animation runs when the user sets reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(path);

      const running = await page.evaluate(() =>
        document.getAnimations().map((animation) => String(animation.id || animation.constructor.name)),
      );
      expect(running).toEqual([]);
    });

    test("STE-05: interface text has no contractions", async ({ page }) => {
      await page.goto(path);

      for (const text of await interfaceText(page)) {
        expect(text, "A contraction in interface text").not.toMatch(contraction);
      }
    });
  });
}

// The text that the application wrote: visible text, text for assistive
// technology and the page metadata. Text from external services is not included.
async function interfaceText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const texts: string[] = [document.title];
    const description = document.querySelector('meta[name="description"]')?.getAttribute("content");
    if (description) texts.push(description);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const parent = node.parentElement;
      if (!parent || parent.closest("script, style, [data-external-text]")) continue;
      if (node.textContent!.trim()) texts.push(node.textContent!.trim());
    }

    for (const element of document.body.querySelectorAll("[alt], [title], [aria-label], [placeholder], input[value]")) {
      if (element.closest("[data-external-text]")) continue;
      for (const attribute of ["alt", "title", "aria-label", "placeholder", "value"]) {
        const value = element.getAttribute(attribute);
        if (value) texts.push(value);
      }
    }
    return texts;
  });
}
