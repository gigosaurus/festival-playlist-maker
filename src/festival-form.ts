import { isClashfinderPageId } from "./clashfinder.ts";

// The "Add a festival" form. The values are the text that the admin entered, so
// that the page can show them again with the problems.
export interface FestivalFormValues {
  name: string;
  year: string;
  startDate: string;
  endDate: string;
  expectedGenres: string;
  // The search text for Clashfinder. When it is empty, the search uses the name.
  search: string;
  // The ID of the chosen Clashfinder page.
  page: string;
}

export type FestivalField = Exclude<keyof FestivalFormValues, "search">;

// The order of the fields on the page. The error summary uses the same order.
export const festivalFields: readonly FestivalField[] = ["name", "year", "startDate", "endDate", "expectedGenres", "page"];

export type FieldProblems = Partial<Record<FestivalField, string>>;

export interface ValidFestival {
  name: string;
  year: number;
  startDate: string;
  endDate: string;
  expectedGenres: string[];
  page: string;
}

export const maximumNameLength = 100;
export const maximumGenres = 20;
export const maximumGenreLength = 50;
const firstYear = 2000;
const lastYear = 2100;

export function readFestivalForm(form: Record<string, unknown>): FestivalFormValues {
  const value = (key: string) => (typeof form[key] === "string" ? (form[key] as string) : "");
  return {
    name: value("name").trim(),
    year: value("year").trim(),
    startDate: value("startDate").trim(),
    endDate: value("endDate").trim(),
    expectedGenres: value("expectedGenres"),
    search: value("search").trim(),
    page: value("page").trim(),
  };
}

export function validateFestival(values: FestivalFormValues): { festival: ValidFestival } | { problems: FieldProblems } {
  const problems: FieldProblems = {};

  if (values.name === "") problems.name = "Enter the name of the festival.";
  else if (values.name.length > maximumNameLength) {
    problems.name = `Enter a name of ${maximumNameLength} characters or fewer.`;
  }

  const year = Number(values.year);
  // The application adds the year to the name, for example in the playlist name "Download 2027".
  if (problems.name === undefined && /^\d{4}$/.test(values.year) && values.name.includes(values.year)) {
    problems.name = `Enter the name without the year. The application adds ${values.year} to the name.`;
  }
  if (values.year === "") problems.year = "Enter the year of the festival.";
  else if (!/^\d{4}$/.test(values.year) || year < firstYear || year > lastYear) {
    problems.year = `Enter the year as four digits from ${firstYear} to ${lastYear}, for example 2027.`;
  }

  const startDate = readDate(values.startDate);
  if (values.startDate === "") problems.startDate = "Enter the first day of the festival.";
  else if (startDate === undefined) problems.startDate = "Enter the start date as a date, for example 2027-06-11.";
  else if (problems.year === undefined && startDate.slice(0, 4) !== values.year) {
    problems.startDate = `Enter a start date in ${values.year}, or change the year.`;
  }

  const endDate = readDate(values.endDate);
  if (values.endDate === "") problems.endDate = "Enter the last day of the festival.";
  else if (endDate === undefined) problems.endDate = "Enter the end date as a date, for example 2027-06-13.";
  else if (startDate !== undefined && endDate < startDate) {
    problems.endDate = "Enter an end date on or after the start date.";
  }

  const expectedGenres = readGenres(values.expectedGenres);
  if (expectedGenres.length === 0) problems.expectedGenres = "Enter one or more expected genres.";
  else if (expectedGenres.length > maximumGenres) {
    problems.expectedGenres = `Enter a maximum of ${maximumGenres} expected genres.`;
  } else if (expectedGenres.some((genre) => genre.length > maximumGenreLength)) {
    problems.expectedGenres = `Enter each genre with ${maximumGenreLength} characters or fewer.`;
  }

  // The page shows "Add the festival" only with search results.
  if (!isClashfinderPageId(values.page)) problems.page = "Choose a Clashfinder page from the search results.";

  if (Object.keys(problems).length > 0) return { problems };
  return {
    festival: {
      name: values.name,
      year,
      startDate: startDate!,
      endDate: endDate!,
      expectedGenres,
      page: values.page,
    },
  };
}

// The festival dates for the Clashfinder search, when both dates are valid.
export function searchDates(values: FestivalFormValues): { start: string; end: string } | undefined {
  const start = readDate(values.startDate);
  const end = readDate(values.endDate);
  if (start === undefined || end === undefined || end < start) return undefined;
  return { start, end };
}

// The genres in the order that the admin entered them, without duplicates.
export function readGenres(text: string): string[] {
  const genres = new Map<string, string>();
  for (const part of text.split(",")) {
    const genre = part.replace(/\s+/g, " ").trim();
    if (genre !== "" && !genres.has(genre.toLowerCase())) genres.set(genre.toLowerCase(), genre);
  }
  return [...genres.values()];
}

// An ISO date (YYYY-MM-DD) that exists in the calendar.
function readDate(text: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text ? text : undefined;
}
