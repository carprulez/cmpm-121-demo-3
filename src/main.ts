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

// Cache state storage using Memento pattern
interface CacheMemento {
  value: number;
  hasCache: boolean;
}

const cacheMementos = new Map<string, CacheMemento>();
const activeCaches = new Map<string, leaflet.Rectangle>();

// Geolocation toggle button
const sensorButton = document.getElementById("sensor")!;
let geolocationWatchId: number | null = null;

let playerLat = 36.98949379578401;
let playerLng = -122.06277128548504;

// Polyline to track the player's movement history
const movementHistory: leaflet.LatLng[] = []; // Store positions for polyline
const movementPolyline = leaflet.polyline(movementHistory, {
  color: "pink",
  weight: 6,
  opacity: 1,
}).addTo(map);

function updatePlayerPosition(newLat: number, newLng: number) {
  playerLat = newLat;
  playerLng = newLng;

  const playerLocation = leaflet.latLng(newLat, newLng);
  map.setView(playerLocation, GAMEPLAY_ZOOM_LEVEL);
  playerMarker.setLatLng(playerLocation);

  // Add new position to movement history
  movementHistory.push(playerLocation);
  movementPolyline.setLatLngs(movementHistory); // Update the polyline

  clearActiveCaches();
  spawnVisibleCaches(playerLocation);

  // Save player state to localStorage
  savePlayerState();
}

// Geolocation activation when 🌐 button is pressed
sensorButton.addEventListener("click", () => {
  if (geolocationWatchId !== null) {
    navigator.geolocation.clearWatch(geolocationWatchId);
    geolocationWatchId = null;
    sensorButton.innerText = "🌐";
  } else {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updatePlayerPosition(latitude, longitude);
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      { enableHighAccuracy: true },
    );
  }
});

function createCacheMemento(i: number, j: number, value: number) {
  cacheMementos.set(`${i}:${j}`, { value, hasCache: true });
}

function restoreCacheFromMemento(i: number, j: number): number | null {
  const memento = cacheMementos.get(`${i}:${j}`);
  return memento && memento.hasCache ? memento.value : null;
}

// Remove all active caches from the map
function clearActiveCaches() {
  activeCaches.forEach((cache) => map.removeLayer(cache));
  activeCaches.clear();
}

// Spawning and displaying cache on the map
function spawnCache(i: number, j: number) {
  const cacheCell = board.getCanonicalCell({ i, j });
  const bounds = board.getCellBounds(cacheCell);
  const cacheKey = `${i}:${j}`;

  let coinValue = restoreCacheFromMemento(i, j) ??
    Math.floor(luck([i, j, "initialValue"].toString()) * 100);
  createCacheMemento(i, j, coinValue); // Save this value to the memento in case it’s new

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);
  activeCaches.set(cacheKey, rect);

  rect.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at "${i}:${j}". Value: <span id="value">${coinValue}</span>.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (coinValue > 0) {
          playerCoins++;
          coinValue--;
          cacheMementos.set(cacheKey, { value: coinValue, hasCache: true });
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
          savePlayerState(); // Save state after collecting coins
        }
      },
    );

    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      () => {
        if (playerCoins > 0) {
          playerCoins--;
          coinValue++;
          cacheMementos.set(cacheKey, { value: coinValue, hasCache: true });
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
          savePlayerState(); // Save state after depositing coins
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
      !activeCaches.has(cacheKey) &&
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

// Persistent storage functions
function savePlayerState() {
  const playerState = {
    playerLat,
    playerLng,
    playerCoins,
    cacheMementos: Array.from(cacheMementos.entries()),
    movementHistory: movementHistory.map((latLng) => [latLng.lat, latLng.lng]), // Save latLng points
  };
  localStorage.setItem("playerState", JSON.stringify(playerState));
}

function loadPlayerState() {
  const savedState = localStorage.getItem("playerState");
  if (savedState) {
    const {
      playerLat: lat,
      playerLng: lng,
      playerCoins: coins,
      cacheMementos: mementos,
      movementHistory,
    } = JSON.parse(savedState);
    playerLat = lat;
    playerLng = lng;
    playerCoins = coins;
    cacheMementos.clear();
    mementos.forEach(([key, value]: [string, CacheMemento]) => {
      cacheMementos.set(key, value);
    });

    movementHistory.forEach(([lat, lng]: [number, number]) => {
      const position = leaflet.latLng(lat, lng);
      movementHistory.push(position);
    });

    movementPolyline.setLatLngs(movementHistory); // Restore polyline with movement history
    updatePlayerPosition(playerLat, playerLng); // Update player position and center map
  }
}

// Reset the game state when the 🚮 button is pressed
const resetButton = document.getElementById("reset")!;
resetButton.addEventListener("click", () => {
  const confirmation = prompt(
    "Are you sure you want to reset the game? All progress will be erased.",
  );
  if (confirmation?.toLowerCase() === "yes") {
    // Clear game state
    playerCoins = 0;
    movementHistory.length = 0;
    movementPolyline.setLatLngs([]);
    clearActiveCaches();
    cacheMementos.clear();
    updatePlayerPosition(NULL_ISLAND.lat, NULL_ISLAND.lng); // Reset player position
    statusPanel.innerHTML = "No coins yet...";
    localStorage.removeItem("playerState"); // Remove saved state
  }
});

// Load saved state when the page loads
loadPlayerState();
