// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

// Style sheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import luck from "./luck.ts";

// Null Island coordinates
const NULL_ISLAND = { lat: 0, lng: 0 };

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4; // Grid cell size in degrees
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Initialize the map centered on Null Island
const map = leaflet.map(document.getElementById("map")!, {
  center: NULL_ISLAND,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

// Player's coin count
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

// Function to convert latitude/longitude to grid cell coordinates anchored at Null Island
function _latLngToCell(lat: number, lng: number) {
  const i = Math.floor(lat / TILE_DEGREES);
  const j = Math.floor(lng / TILE_DEGREES);
  return { i, j };
}

// Spawn a cache based on cell coordinates
function spawnCache(i: number, j: number) {
  const bounds = leaflet.latLngBounds([
    [NULL_ISLAND.lat + i * TILE_DEGREES, NULL_ISLAND.lng + j * TILE_DEGREES],
    [
      NULL_ISLAND.lat + (i + 1) * TILE_DEGREES,
      NULL_ISLAND.lng + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Bind a popup with a coin value to the cache
  rect.bindPopup(() => {
    let coinValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at "${i},${j}" with value <span id="value">${coinValue}</span>.</div>
      <button id="collect">Collect</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    return popupDiv;
  });
}

// Populate the map with caches around the player’s location in the neighborhood
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
