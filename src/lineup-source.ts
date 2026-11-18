// A lineup source gives the lineup of one festival. Each festival stores the
// name of its lineup source and the settings for it.

// One appearance of a name on the lineup. A source gives the day, the stage and
// the set times only when it has them. Version 1 stores them for version 2.
export interface LineupEntry {
  name: string;
  // The festival day, as an ISO date.
  day?: string;
  stage?: string;
  // Local times at the festival, as "YYYY-MM-DDTHH:MM".
  start?: string;
  end?: string;
}

export interface Lineup {
  // A name can have more than one entry, for example one for each day.
  entries: LineupEntry[];
  // The IANA timezone of the local times, when the source gives it.
  timezone?: string;
}

export type LineupResult = { outcome: "got"; lineup: Lineup } | { outcome: "failed"; cause: string };

// Version 1 has one lineup source. The festival app APIs come later (ADR-0004).
export interface ClashfinderSettings {
  source: "clashfinder";
  // The ID of the Clashfinder page: the text after "clashfinder.com/s/".
  page: string;
  // The name of the page when the admin chose it.
  pageName: string;
}

export type LineupSourceSettings = ClashfinderSettings;

export interface LineupSource {
  getLineup(settings: LineupSourceSettings): Promise<LineupResult>;
}
