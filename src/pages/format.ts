// Date and time formats for all pages (CT-05). The users are in the United Kingdom.

const dayMonthYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// A time that the application recorded, for example "18 November 2026 at 17:10".
const dateAndTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/London",
});

// An ISO date, for example "11 June 2027".
export function formatDate(isoDate: string): string {
  return dayMonthYear.format(new Date(`${isoDate}T00:00:00Z`));
}

// Two ISO dates, for example "11–13 June 2027".
export function formatDateRange(startDate: string, endDate: string): string {
  return dayMonthYear.formatRange(new Date(`${startDate}T00:00:00Z`), new Date(`${endDate}T00:00:00Z`));
}

export function formatDateAndTime(time: Date): string {
  return dateAndTime.format(time);
}

// "1 lineup name", "62 lineup names".
export function count(number: number, singular: string, plural: string): string {
  return `${number} ${number === 1 ? singular : plural}`;
}

const regionNames = new Intl.DisplayNames(["en-GB"], { type: "region" });

// An ISO 3166-1 code as a country name, for example "GB" as "United Kingdom".
export function formatCountry(code: string): string {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
