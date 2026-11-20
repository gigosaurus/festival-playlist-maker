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

// A Spotify track ID (22 characters) for song `song` of artist `artist`.
export function testTrackId(artist: number, song: number): string {
  return `t${String(artist).padStart(3, "0")}s${String(song).padStart(2, "0")}`.padEnd(22, "x");
}

// The number of predicted songs of each artist: 10, except each tenth artist,
// which has 1, and the last artist, which has none. At Curious, the playlist
// therefore has 135 × 2 + 14 × 1 = 284 songs by 149 artists.
function predictedSongCount(index: number): number {
  if (index === 149) return 0;
  return index % 10 === 9 ? 1 : 10;
}

export const largeFestival: TestFestival = {
  name: "Download",
  year: 2027,
  startDate: "2027-06-11",
  endDate: "2027-06-13",
  artists: artistNames().map((name, index) => ({
    name,
    genres: genreSets[index % genreSets.length]!,
    trackIds: Array.from({ length: predictedSongCount(index) }, (_, song) => testTrackId(index, song)),
  })),
  noMatch: ["???", "Special guest TBA"],
};
