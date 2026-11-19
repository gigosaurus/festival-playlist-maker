import type { TestFestival } from "./fixtures.ts";

// A festival with a lineup of 150 artists and 2 names marked "no match", for
// the Festival page tests. The names are made from two word lists, plus three
// names with special cases: accents, and a name that contains a different name.
const firstWords = ["Black", "Silent", "Iron", "Northern", "Burning", "Hollow", "Crimson", "Electric", "Static", "Wild", "Lost", "Broken"];
const secondWords = ["Harbour", "Wolves", "Signal", "Engine", "Choir", "Valley", "Static", "Tide", "Lanterns", "Saints", "Kings", "Echo", "Machine"];
const genreSets = [["metalcore", "post-hardcore"], ["hard rock"], ["punk rock", "pop punk", "emo"], ["heavy metal", "thrash metal"], []];

export const specialArtists = ["Mötley Crüe", "Bring Me The Horizon", "Ghost"];

function artistNames(): string[] {
  const names = firstWords.flatMap((first) => secondWords.filter((second) => second !== first).map((second) => `${first} ${second}`));
  return [...specialArtists, ...names].slice(0, 150);
}

export const largeFestival: TestFestival = {
  name: "Download",
  year: 2027,
  startDate: "2027-06-11",
  endDate: "2027-06-13",
  artists: artistNames().map((name, index) => ({ name, genres: genreSets[index % genreSets.length]! })),
  noMatch: ["???", "Special guest TBA"],
};
