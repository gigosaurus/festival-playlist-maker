// The Festival page (src/pages/festival-page.ts).
// - Saves the interest level of an artist immediately when the user changes it.
// - Shows the search, the filters and the sort, and applies them to the lineup.
//   The filter "Only new artists" shows only when one or more artists are new.
// - Changes the number of songs in the playlist after each saved interest level.
// - Prevents a second "Make the playlist" while the first one waits for Spotify.
// - Plays the predicted songs of an artist in the Spotify embed player (#18). The page
//   loads the Spotify iFrame API only when the user selects "Play the songs" the first time.
//   One player shows at a time, under the artist.
// The address keeps the search, the filter and the sort, so that a reload and
// Back show the same list.

const levels = ["not-interested", "curious", "keen", "must-see"];

const tools = document.querySelector("[data-lineup-tools]");
const form = document.querySelector("[data-interest-levels]");
const lineupCount = document.querySelector("[data-lineup-count]");
const playlistCount = document.querySelector("[data-playlist-count]");
const songCounts = JSON.parse(playlistCount.dataset.songCounts);
const playlistForm = document.querySelector("[data-playlist-form]");
const showAll = document.querySelector("[data-show-all]");
const updateList = document.querySelector("[data-update-list]");
const list = form.querySelector("ul");
const searchInput = tools.elements.search;
const levelSelect = tools.elements.level;
const sortSelect = tools.elements.sort;
// Undefined when no artist is new since the last update.
const newCheck = tools.elements.new;

// The open Spotify embed player: the listen element of the artist, the track IDs,
// the position of the song and the Spotify controller. Undefined when no player is open.
let player;
// The promise of the Spotify iFrame API, after the first "Play the songs".
let spotifyApi;

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
  predictedSongs: Number(element.dataset.songs),
  isNew: element.dataset.new !== undefined,
  version: 0,
  sending: Promise.resolve(),
}));

for (const button of form.querySelectorAll("[data-play]")) button.hidden = false;
tools.hidden = false;
form.querySelector("[data-save-all]").hidden = true;
readAddress();
apply();

tools.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("submit", (event) => event.preventDefault());
// Spotify can need some seconds. The browser shows its loading state, and the button
// shows that the request is in progress.
playlistForm.addEventListener("submit", (event) => {
  const button = playlistForm.querySelector("button");
  if (button.disabled) {
    event.preventDefault();
    return;
  }
  button.dataset.label = button.textContent;
  button.disabled = true;
  button.textContent = button.textContent.startsWith("Make") ? "Making the playlist…" : "Updating the playlist…";
});
// After Back, the browser can show the page from its cache, with the button disabled.
addEventListener("pageshow", () => {
  const button = playlistForm.querySelector("button");
  if (button.dataset.label === undefined) return;
  button.disabled = false;
  button.textContent = button.dataset.label;
});
tools.addEventListener("input", () => {
  writeAddress();
  apply();
});
showAll.querySelector("button").addEventListener("click", () => {
  searchInput.value = "";
  levelSelect.value = "";
  if (newCheck) newCheck.checked = false;
  writeAddress();
  apply();
  searchInput.focus();
});
updateList.querySelector("button").addEventListener("click", () => {
  apply();
  lineupCount.focus();
});
form.addEventListener("click", (event) => {
  const button = event.target.closest("[data-play]");
  if (button === null) return;
  const listen = button.closest(".listen");
  if (player?.listen === listen) closePlayer();
  else openPlayer(listen);
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
  if (newCheck) newCheck.checked = query.get("new") === "1";
}

function writeAddress() {
  const query = new URLSearchParams();
  if (searchInput.value.trim() !== "") query.set("search", searchInput.value.trim());
  if (levelSelect.value !== "") query.set("level", levelSelect.value);
  if (sortSelect.value !== "") query.set("sort", sortSelect.value);
  if (newCheck?.checked) query.set("new", "1");
  const search = query.size > 0 ? `?${query}` : "";
  history.replaceState(history.state, "", `${location.pathname}${search}`);
}

// The artists that the search and the filter give, in the order of the sort.
function view() {
  const search = comparable(searchInput.value);
  const level = levelSelect.value;
  const onlyNew = newCheck?.checked ?? false;
  const result = artists.filter(
    (artist) => artist.name.includes(search) && (level === "" || artist.level === level) && (!onlyNew || artist.isNew),
  );
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

// Shows the artists of the view, in its order, and hides the others. The rows move
// only when the order changes. A move loads the player again, so then the player closes.
function apply() {
  const result = view();
  const visible = new Set(result);
  for (const artist of artists) artist.element.hidden = !visible.has(artist);
  const inPage = [...list.children].map((element) => artists.find((artist) => artist.element === element)).filter((artist) => visible.has(artist));
  if (!sameOrder(result, inPage)) {
    closePlayer();
    list.append(...result.map((artist) => artist.element), ...artists.filter((artist) => !visible.has(artist)).map((artist) => artist.element));
  }
  if (player !== undefined && player.listen.closest(".artist").hidden) closePlayer();
  lineupCount.textContent = countText(result.length);
  showAll.hidden = result.length > 0;
  updateList.hidden = true;
}

function countText(number) {
  const total = artists.length;
  const search = searchInput.value.trim();
  const level = levelSelect.value === "" ? "" : levelSelect.selectedOptions[0].textContent;
  const onlyNew = newCheck?.checked ?? false;
  if (search === "" && level === "" && !onlyNew) return artistCount(total);
  if (number > 0) return `${number} of ${artistCount(total)}`;
  const artistWord = onlyNew ? "new artist" : "artist";
  if (search !== "" && level !== "") return `No ${artistWord} with the interest level ${level} matches “${search}”.`;
  if (search !== "") return `No ${artistWord} matches “${search}”.`;
  return `No ${artistWord} has the interest level ${level}.`;
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

// The same numbers as playlistCount in src/pages/festival-page.ts.
function updatePlaylistCount() {
  const songs = artists.map((artist) => Math.min(songCounts[artist.saved], artist.predictedSongs));
  const total = songs.reduce((sum, each) => sum + each, 0);
  const playlistArtists = songs.filter((each) => each > 0).length;
  playlistCount.textContent = `The playlist will contain ${total} ${total === 1 ? "song" : "songs"} by ${playlistArtists} of ${artistCount(artists.length)}.`;
}

// The Spotify iFrame API, loaded one time. Spotify calls onSpotifyIframeApiReady when it is ready.
function loadSpotifyApi() {
  spotifyApi ??= new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement("script");
    script.src = "https://open.spotify.com/embed/iframe-api/v1";
    script.async = true;
    script.addEventListener("error", () => {
      spotifyApi = undefined;
      script.remove();
      reject(new Error("The Spotify iFrame API did not load."));
    });
    document.head.append(script);
  });
  return spotifyApi;
}

function openPlayer(listen) {
  closePlayer();
  const button = listen.querySelector("[data-play]");
  const name = listen.closest(".artist").querySelector(".artist-name").textContent;
  const element = document.createElement("div");
  element.className = "listen-player";
  element.innerHTML = `
    <div class="listen-embed"><div></div></div>
    <p class="listen-controls">
      <button class="button-secondary listen-control" type="button" data-previous>Previous song</button>
      <span class="listen-position" data-position></span>
      <button class="button-secondary listen-control" type="button" data-next>Next song</button>
    </p>
    <p class="field-problem" role="alert" data-player-problem hidden></p>
  `;
  listen.append(element);
  const current = { listen, element, button, name, trackIds: listen.dataset.tracks.split(" "), position: 0, controller: undefined };
  player = current;
  button.setAttribute("aria-expanded", "true");
  button.querySelector("[data-play-label]").textContent = "Close the player";
  element.querySelector("[data-previous]").addEventListener("click", () => playSong(current, current.position - 1));
  element.querySelector("[data-next]").addEventListener("click", () => playSong(current, current.position + 1));
  showPosition(current);
  loadSpotifyApi().then(
    (api) => {
      if (player !== current) return;
      api.createController(
        element.querySelector(".listen-embed > div"),
        { uri: trackUri(current.trackIds[0]), width: "100%", height: 80 },
        (controller) => {
          if (player !== current) {
            controller.destroy();
            return;
          }
          current.controller = controller;
          controller.iframeElement.title = `Spotify player for ${name}`;
          controller.addListener("playback_update", (update) => onPlaybackUpdate(current, update.data));
          controller.play();
        },
      );
    },
    () => {
      if (player !== current) return;
      const problem = element.querySelector("[data-player-problem]");
      problem.textContent = "The Spotify player did not load. Try again later.";
      problem.hidden = false;
      for (const control of element.querySelectorAll(".listen-control")) control.disabled = true;
    },
  );
}

function closePlayer() {
  if (player === undefined) return;
  const { element, button, controller } = player;
  player = undefined;
  controller?.destroy();
  element.remove();
  button.setAttribute("aria-expanded", "false");
  button.querySelector("[data-play-label]").textContent = "Play the songs";
}

function playSong(current, position) {
  if (position < 0 || position >= current.trackIds.length) return;
  current.position = position;
  current.ended = false;
  showPosition(current);
  if (current.controller === undefined) return;
  current.controller.loadUri(trackUri(current.trackIds[position]));
  current.controller.play();
}

// "Song 2 of 7". The first song has no previous song, and the last song has no next song.
function showPosition(current) {
  const { element, position, trackIds } = current;
  element.querySelector("[data-position]").textContent = `Song ${position + 1} of ${trackIds.length}`;
  element.querySelector("[data-previous]").disabled = position === 0;
  element.querySelector("[data-next]").disabled = position === trackIds.length - 1;
}

// At the end of a song, the player plays the next song. Spotify gives the position
// and the duration in milliseconds. At the end, the player stops at the duration or
// goes back to 0.
function onPlaybackUpdate(current, { isPaused, position, duration }) {
  if (player !== current || !(duration > 0)) return;
  if (!isPaused) {
    current.lastPosition = position;
    return;
  }
  const nearEnd = (value) => value >= duration - 1500;
  if (current.ended || !(nearEnd(position) || (position === 0 && nearEnd(current.lastPosition ?? 0)))) return;
  current.ended = true;
  current.lastPosition = 0;
  playSong(current, current.position + 1);
}

function trackUri(id) {
  return `spotify:track:${id}`;
}
