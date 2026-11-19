import type { Page } from "@playwright/test";
import { expect } from "./fixtures.ts";

// Steps for tests that need a festival with artist matches.

// The searches run in the background. The admin loads the page again to see new results.
export async function waitForSearches(page: Page): Promise<void> {
  await expect(async () => {
    await page.reload();
    await expect(page.getByText("Waiting for the MusicBrainz search.")).toHaveCount(0);
  }).toPass();
}

// On Admin: artist matches, saves the proposal of each name, or "No match" when
// nothing is proposed, until `keep` names stay without a match.
export async function matchNames(page: Page, keep = 0): Promise<void> {
  const unmatched = page.getByRole("region", { name: /^Names without an artist match/ }).getByRole("article");
  while ((await unmatched.count()) > keep) {
    const name = unmatched.first();
    if ((await name.getByRole("radio", { checked: true }).count()) === 0) {
      await name.getByRole("radio", { name: /^No match/ }).check();
    }
    const before = await unmatched.count();
    await name.getByRole("button", { name: /^Save the match for/ }).click();
    await expect(unmatched).toHaveCount(before - 1);
  }
}
