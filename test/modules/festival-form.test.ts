import assert from "node:assert/strict";
import { test } from "node:test";
import { readFestivalForm, readGenres, searchDates, validateFestival, type FestivalFormValues } from "../../src/festival-form.ts";

const valid: FestivalFormValues = {
  name: "Download",
  year: "2027",
  startDate: "2027-06-11",
  endDate: "2027-06-13",
  expectedGenres: "metal, hard rock,  metalcore ",
  search: "",
  page: "download27",
};

function problemsFor(values: Partial<FestivalFormValues>) {
  const result = validateFestival({ ...valid, ...values });
  return "problems" in result ? result.problems : {};
}

test("validateFestival accepts a complete festival", () => {
  assert.deepEqual(validateFestival(valid), {
    festival: {
      name: "Download",
      year: 2027,
      startDate: "2027-06-11",
      endDate: "2027-06-13",
      expectedGenres: ["metal", "hard rock", "metalcore"],
      page: "download27",
    },
  });
});

test("validateFestival tells the admin what to enter for each missing value", () => {
  const result = validateFestival(readFestivalForm({}));

  assert.deepEqual(result, {
    problems: {
      name: "Enter the name of the festival.",
      year: "Enter the year of the festival.",
      startDate: "Enter the first day of the festival.",
      endDate: "Enter the last day of the festival.",
      expectedGenres: "Enter one or more expected genres.",
      page: "Choose a Clashfinder page from the search results.",
    },
  });
});

test("validateFestival refuses incorrect and out-of-range values, and tells how to correct them", () => {
  assert.deepEqual(problemsFor({ year: "27" }), { year: "Enter the year as four digits from 2000 to 2100, for example 2027." });
  assert.deepEqual(problemsFor({ year: "2207", startDate: "2207-06-11", endDate: "2207-06-13" }), {
    year: "Enter the year as four digits from 2000 to 2100, for example 2027.",
  });
  assert.deepEqual(problemsFor({ startDate: "2027-02-30" }), { startDate: "Enter the start date as a date, for example 2027-06-11." });
  assert.deepEqual(problemsFor({ startDate: "2026-06-11" }), { startDate: "Enter a start date in 2027, or change the year." });
  assert.deepEqual(problemsFor({ endDate: "2027-06-10" }), { endDate: "Enter an end date on or after the start date." });
  assert.deepEqual(problemsFor({ name: "x".repeat(101) }), { name: "Enter a name of 100 characters or fewer." });
  assert.deepEqual(problemsFor({ name: "Download 2027" }), {
    name: "Enter the name without the year. The application adds 2027 to the name.",
  });
  assert.deepEqual(problemsFor({ expectedGenres: " , ," }), { expectedGenres: "Enter one or more expected genres." });
  assert.deepEqual(problemsFor({ page: "../../etc" }), { page: "Choose a Clashfinder page from the search results." });
});

test("validateFestival accepts a festival that ends in the next year", () => {
  assert.ok("festival" in validateFestival({ ...valid, startDate: "2027-12-30", endDate: "2028-01-01" }));
});

test("readGenres removes duplicates that differ only in case, and keeps the order", () => {
  assert.deepEqual(readGenres("Metal, metal, Hard  Rock,,punk"), ["Metal", "Hard Rock", "punk"]);
});

test("searchDates gives the festival dates only when both dates are valid", () => {
  assert.deepEqual(searchDates(valid), { start: "2027-06-11", end: "2027-06-13" });
  assert.equal(searchDates({ ...valid, endDate: "" }), undefined);
  assert.equal(searchDates({ ...valid, endDate: "2027-06-01" }), undefined);
});
