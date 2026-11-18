import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";

// Gives a path to a new SQLite file in a temporary directory. The test runner
// deletes the directory after the test.
export function temporaryDatabasePath(test: TestContext): string {
  const directory = mkdtempSync(join(tmpdir(), "festival-playlist-maker-"));
  test.after(() => rmSync(directory, { recursive: true, force: true }));
  return join(directory, "test.sqlite");
}
