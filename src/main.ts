// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

const NULL_ISLAND = leaflet.latLng(0, 0);
const TILE_DEGREES = 1e-4;
const GAMEPLAY_ZOOM_LEVEL = 19;
const NEIGHBORHOOD_SIZE = 8; // Radius of cells around the player to spawn caches
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
let currentPlayerCell = board.getCellForPoint(NULL_ISLAND);

// Store cache coin values in a global map
const cacheCoinValues = new Map<string, number>();
// Store cache markers on the map for clearing when the player moves
let activeCacheMarkers: leaflet.Layer[] = [];

// Generate cache at specific cell location
function spawnCache(i: number, j: number) {
  const cell = board.getCanonicalCell({ i, j });
  const bounds = board.getCellBounds(cell);

  const rect = leaflet.rectangle(bounds);
  activeCacheMarkers.push(rect); // Track the cache marker for easy clearing
  rect.addTo(map);

  const cacheKey = `${i},${j}`;
  if (!cacheCoinValues.has(cacheKey)) {
    cacheCoinValues.set(
      cacheKey,
      Math.floor(luck([i, j, "initialValue"].toString()) * 100),
    );
  }

  rect.bindPopup(() => {
    let coinValue = cacheCoinValues.get(cacheKey)!;
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>Cache at "${i},${j}". Value: <span id="value">${coinValue}</span>.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          cacheCoinValues.set(cacheKey, coinValue);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          coinValue++;
          playerCoins--;
          cacheCoinValues.set(cacheKey, coinValue);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    return popupDiv;
  });
}

// Clear all existing cache markers
function clearCaches() {
  activeCacheMarkers.forEach((marker) => map.removeLayer(marker));
  activeCacheMarkers = [];
}

// Spawn caches around the player's cell within the neighborhood size
function updateCachesAroundPlayer() {
  clearCaches();
  const cellsNearby = board.getCellsNearPoint(playerMarker.getLatLng());
  cellsNearby.forEach((cell) => {
    if (luck(`${cell.i},${cell.j}`) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell.i, cell.j);
    }
  });
}

// Update player position and refresh nearby caches
function movePlayer(di: number, dj: number) {
  const newPlayerCell = board.getCanonicalCell({
    i: currentPlayerCell.i + di,
    j: currentPlayerCell.j + dj,
  });

  if (newPlayerCell !== currentPlayerCell) {
    currentPlayerCell = newPlayerCell;
    const newPlayerLatLng = board.getCellBounds(newPlayerCell).getCenter();
    playerMarker.setLatLng(newPlayerLatLng);
    map.panTo(newPlayerLatLng);
    updateCachesAroundPlayer();
  }
}

// Event listeners for movement buttons
document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);
document.getElementById("reset")!.addEventListener("click", () => {
  currentPlayerCell = board.getCellForPoint(NULL_ISLAND);
  playerMarker.setLatLng(NULL_ISLAND);
  map.panTo(NULL_ISLAND);
  playerCoins = 0;
  statusPanel.innerHTML = "No coins yet...";
  updateCachesAroundPlayer();
});

// Initial cache spawn around starting position
updateCachesAroundPlayer();
