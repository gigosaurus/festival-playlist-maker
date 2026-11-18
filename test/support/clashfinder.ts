import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clashfinderExportUrl, clashfinderListUrl } from "../../src/clashfinder.ts";
import { signClashfinderRequest } from "../../src/http-client.ts";
import type { RecordedResponse } from "./fake-http-client.ts";
import { testSettings } from "./test-settings.ts";

// Recorded Clashfinder responses. test/fixtures/clashfinder/README.md tells how
// they were recorded.
const fixtures = join(import.meta.dirname, "..", "fixtures", "clashfinder");

function recorded(file: string): RecordedResponse {
  return {
    headers: { "content-type": "application/json; charset=UTF-8" },
    body: readFileSync(join(fixtures, file), "utf8"),
  };
}

// The address with the signed keys of the test settings, as the HTTP client sends it.
export function signed(url: string): string {
  return signClashfinderRequest(new Request(url), testSettings()).url;
}

export const signedListUrl = signed(clashfinderListUrl);

export function signedExportUrl(page: string): string {
  return signed(clashfinderExportUrl(page));
}

// A part of data/events/all.json: the Download, Slam Dunk and Bloodstock pages
// from 2025, and the pages that start from 9 to 14 June 2027.
export const listResponse = recorded("all.json");

// data/event/slamdunk2026.json: 2 days, 8 stages, the same acts on each day.
export const slamDunk2026Response = recorded("event-slamdunk2026.json");

// data/event/download27.json: 2 stages, with "???" for names that are not known yet.
export const download2027Response = recorded("event-download27.json");

// Status 401 for a correct username with an incorrect public key.
export const incorrectKeyResponse: RecordedResponse = {
  status: 401,
  headers: { "content-type": "text/html; charset=UTF-8" },
  body: '{"error":"authPublicKey incorrect"}',
};

// Status 401 for a username that Clashfinder does not know.
export const unknownUserResponse: RecordedResponse = {
  status: 401,
  headers: { "content-type": "text/html; charset=UTF-8" },
  body: '{"error":"User not found: nobody-here"}',
};

// Status 404 for a page that does not exist. The text contains a server path.
export const unknownPageResponse: RecordedResponse = {
  status: 404,
  headers: { "content-type": "text/html; charset=UTF-8" },
  body: 'Clashfinder "no-such-page-fpm" not found, sorry :( /home/customer/www/clashfinder.com/public_html/!clashfinder_data/n/no-such-page-fpm/main_data.json',
};
