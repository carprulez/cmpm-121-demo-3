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
const NEIGHBORHOOD_SIZE = 8;
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

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

// Cache coin values storage
const cacheCoinValues = new Map<string, number>();

// Geolocation toggle button
const sensorButton = document.getElementById("sensor")!;
let geolocationWatchId: number | null = null;

function updatePlayerPosition(newLat: number, newLng: number) {
  const playerLocation = leaflet.latLng(newLat, newLng);
  map.setView(playerLocation, GAMEPLAY_ZOOM_LEVEL);
  playerMarker.setLatLng(playerLocation);

  spawnVisibleCaches(playerLocation);
}

// Geolocation activation when 🌐 button is pressed
sensorButton.addEventListener("click", () => {
  if (geolocationWatchId !== null) {
    // Stop tracking if already tracking
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
    sensorButton.innerText = "🌐"; // Reset button state
  } else {
    // Start tracking player position
    geolocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updatePlayerPosition(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true },
    );
    sensorButton.innerText = "🛑"; // Update button to indicate tracking is active
  }
});

// Spawning and displaying cache on the map
function spawnCache(i: number, j: number) {
  const cacheCell = board.getCanonicalCell({ i, j });
  const bounds = board.getCellBounds(cacheCell);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  const cacheKey = `${i}:${j}`;
  const coinValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  cacheCoinValues.set(cacheKey, coinValue);

  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at "${i}:${j}". Value: <span id="value">${coinValue}</span>.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        const currentValue = cacheCoinValues.get(cacheKey) || 0;
        if (currentValue > 0) {
          playerCoins++;
          cacheCoinValues.set(cacheKey, currentValue - 1);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            (currentValue - 1).toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        const currentValue = cacheCoinValues.get(cacheKey) || 0;
        if (playerCoins > 0) {
          playerCoins--;
          cacheCoinValues.set(cacheKey, currentValue + 1);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            (currentValue + 1).toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    return popupDiv;
  });
}

// Spawning caches near the player
function spawnVisibleCaches(playerLocation: leaflet.LatLng) {
  const visibleCells = board.getCellsNearPoint(playerLocation);
  visibleCells.forEach((cell) => {
    const cacheKey = `${cell.i}:${cell.j}`;
    if (
      !cacheCoinValues.has(cacheKey) &&
      luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY
    ) {
      spawnCache(cell.i, cell.j);
    }
  });
}

// Manual player movement with arrow buttons
const directionButtons = {
  north: document.getElementById("north")!,
  south: document.getElementById("south")!,
  east: document.getElementById("east")!,
  west: document.getElementById("west")!,
};

let playerLat = 36.98949379578401;
let playerLng = -122.06277128548504;

directionButtons.north.addEventListener("click", () => {
  playerLat += TILE_DEGREES;
  updatePlayerPosition(playerLat, playerLng);
});
directionButtons.south.addEventListener("click", () => {
  playerLat -= TILE_DEGREES;
  updatePlayerPosition(playerLat, playerLng);
});
directionButtons.east.addEventListener("click", () => {
  playerLng += TILE_DEGREES;
  updatePlayerPosition(playerLat, playerLng);
});
directionButtons.west.addEventListener("click", () => {
  playerLng -= TILE_DEGREES;
  updatePlayerPosition(playerLat, playerLng);
});

// Initialize player at Oakes College classroom location
updatePlayerPosition(playerLat, playerLng);
