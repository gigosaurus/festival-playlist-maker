// The Festival page (src/pages/festival-page.ts).
// - Saves the interest level of an artist immediately when the user changes it.
// - Shows the search, the filter and the sort, and applies them to the lineup.
// The address keeps the search, the filter and the sort, so that a reload and
// Back show the same list.

const levels = ["not-interested", "curious", "keen", "must-see"];

const tools = document.querySelector("[data-lineup-tools]");
const form = document.querySelector("[data-interest-levels]");
const lineupCount = document.querySelector("[data-lineup-count]");
const playlistCount = document.querySelector("[data-playlist-count]");
const showAll = document.querySelector("[data-show-all]");
const updateList = document.querySelector("[data-update-list]");
const list = form.querySelector("ul");
const searchInput = tools.elements.search;
const levelSelect = tools.elements.level;
const sortSelect = tools.elements.sort;

// One entry for each artist. `level` is the level in the page. `saved` is the
// last level that the application saved. `version` counts the changes, so that
// only the result of the last change updates the row.
const artists = [...list.children].map((element) => ({
  element,
  id: element.dataset.artist,
  index: Number(element.dataset.index),
  name: comparable(element.querySelector(".artist-name").textContent),
  level: element.dataset.level,
  saved: element.dataset.level,
  version: 0,
  sending: Promise.resolve(),
}));

tools.hidden = false;
form.querySelector("[data-save-all]").hidden = true;
readAddress();
apply();

tools.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("submit", (event) => event.preventDefault());
tools.addEventListener("input", () => {
  writeAddress();
  apply();
});
showAll.querySelector("button").addEventListener("click", () => {
  searchInput.value = "";
  levelSelect.value = "";
  writeAddress();
  apply();
  searchInput.focus();
});
updateList.querySelector("button").addEventListener("click", () => {
  apply();
  lineupCount.focus();
});
form.addEventListener("change", (event) => {
  const input = event.target;
  const artist = artists.find((each) => each.element.contains(input));
  if (artist === undefined || !input.checked) return;
  setLevel(artist, input.value);
  updateList.hidden = sameOrder(view(), shown());
});

// Lowercase, without accents, with "&" as "and" and each run of other characters as one space.
function comparable(text) {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function readAddress() {
  const query = new URLSearchParams(location.search);
  searchInput.value = query.get("search") ?? "";
  levelSelect.value = levels.includes(query.get("level")) ? query.get("level") : "";
  sortSelect.value = query.get("sort") === "level" ? "level" : "";
}

function writeAddress() {
  const query = new URLSearchParams();
  if (searchInput.value.trim() !== "") query.set("search", searchInput.value.trim());
  if (levelSelect.value !== "") query.set("level", levelSelect.value);
  if (sortSelect.value !== "") query.set("sort", sortSelect.value);
  const search = query.size > 0 ? `?${query}` : "";
  history.replaceState(history.state, "", `${location.pathname}${search}`);
}

// The artists that the search and the filter give, in the order of the sort.
function view() {
  const search = comparable(searchInput.value);
  const level = levelSelect.value;
  const result = artists.filter((artist) => artist.name.includes(search) && (level === "" || artist.level === level));
  if (sortSelect.value === "level") {
    result.sort((a, b) => levels.indexOf(b.level) - levels.indexOf(a.level) || a.index - b.index);
  } else {
    result.sort((a, b) => a.index - b.index);
  }
  return result;
}

// The artists that the page shows, in the order of the page.
function shown() {
  return artists.filter((artist) => !artist.element.hidden).sort((a, b) => order(a) - order(b));
}

function order(artist) {
  return [...list.children].indexOf(artist.element);
}

function sameOrder(first, second) {
  return first.length === second.length && first.every((artist, index) => artist === second[index]);
}

// Shows the artists of the view, in its order, and hides the others.
function apply() {
  const result = view();
  const visible = new Set(result);
  for (const artist of artists) artist.element.hidden = !visible.has(artist);
  list.append(...result.map((artist) => artist.element), ...artists.filter((artist) => !visible.has(artist)).map((artist) => artist.element));
  lineupCount.textContent = countText(result.length);
  showAll.hidden = result.length > 0;
  updateList.hidden = true;
}

function countText(number) {
  const total = artists.length;
  const search = searchInput.value.trim();
  const level = levelSelect.value === "" ? "" : levelSelect.selectedOptions[0].textContent;
  if (search === "" && level === "") return artistCount(total);
  if (number > 0) return `${number} of ${artistCount(total)}`;
  if (search !== "" && level !== "") return `No artist with the interest level ${level} matches “${search}”.`;
  if (search !== "") return `No artist matches “${search}”.`;
  return `No artist has the interest level ${level}.`;
}

function artistCount(number) {
  return `${number} ${number === 1 ? "artist" : "artists"}`;
}

// Saves the level. The changes of one artist go to the server one at a time,
// in order, so that the last change is the saved level.
function setLevel(artist, level) {
  artist.level = level;
  artist.element.dataset.level = level;
  artist.version += 1;
  const version = artist.version;
  artist.sending = artist.sending.then(async () => {
    const saved = await save(artist, level);
    if (saved) artist.saved = level;
    if (version !== artist.version) return;
    const problem = artist.element.querySelector("[data-problem]");
    if (saved) {
      problem.hidden = true;
      problem.textContent = "";
    } else {
      // The page shows the level that the application saved last.
      artist.level = artist.saved;
      artist.element.dataset.level = artist.saved;
      artist.element.querySelector(`input[value="${artist.saved}"]`).checked = true;
      problem.textContent = "The application did not save the interest level. Select it again.";
      problem.hidden = false;
    }
    updatePlaylistCount();
  });
}

async function save(artist, level) {
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams({ [`level-${artist.id}`]: level }),
      // The save completes also when the user opens a different page immediately.
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function updatePlaylistCount() {
  const playlist = artists.filter((artist) => artist.saved !== "not-interested").length;
  playlistCount.textContent = `The playlist will contain ${playlist} of ${artistCount(artists.length)}.`;
}
