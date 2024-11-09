// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";

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

const playerMarker = leaflet.marker(NULL_ISLAND);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

// Store cache coin values in a global map
const cacheCoinValues = new Map<string, number>();

function getCacheKey(i: number, j: number): string {
  return `${i},${j}`;
}

function spawnCache(i: number, j: number) {
  const origin = NULL_ISLAND;
  const bounds = leaflet.latLngBounds([
    [origin.lat + i * TILE_DEGREES, origin.lng + j * TILE_DEGREES],
    [origin.lat + (i + 1) * TILE_DEGREES, origin.lng + (j + 1) * TILE_DEGREES],
  ]);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Set initial coin value for the cache if not already set
  const cacheKey = getCacheKey(i, j);
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

// Spawn caches around Null Island for a test area
for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
