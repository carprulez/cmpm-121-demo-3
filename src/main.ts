// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts"; // Import the Board class

const NULL_ISLAND = leaflet.latLng(0, 0);
const TILE_DEGREES = 1e-4;
const GAMEPLAY_ZOOM_LEVEL = 19;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Create an instance of Board with tileWidth and tileVisibilityRadius
const board = new Board(TILE_DEGREES, 1); // Set tileWidth to TILE_DEGREES and radius to 1 (for now)

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

// Store cache coin values and coins per cache in a global map
const cacheCoinValues = new Map<string, number>();
const coinMap = new Map<string, Coin[]>();

interface Coin {
  i: number;
  j: number;
  serial: number;
}

function getCacheKey(i: number, j: number): string {
  return `${i},${j}`;
}

function spawnCache(i: number, j: number) {
  const origin = NULL_ISLAND;

  // Use the Board to get the canonical cell for this point
  const cell = board.getCellForPoint(
    leaflet.latLng(
      origin.lat + i * TILE_DEGREES,
      origin.lng + j * TILE_DEGREES,
    ),
  );

  // Get bounds for the cell
  const bounds = board.getCellBounds(cell);

  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  // Initialize the coin array for this cache if it doesn't exist
  const cacheKey = getCacheKey(cell.i, cell.j);
  if (!coinMap.has(cacheKey)) {
    coinMap.set(cacheKey, []);
  }

  // Set initial coin value for the cache if not already set
  if (!cacheCoinValues.has(cacheKey)) {
    cacheCoinValues.set(
      cacheKey,
      Math.floor(luck([cell.i, cell.j, "initialValue"].toString()) * 100),
    );
  }

  rect.bindPopup(() => {
    let coinValue = cacheCoinValues.get(cacheKey)!;
    const coins = coinMap.get(cacheKey)!;

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>Cache at "${cell.i},${cell.j}". Value: <span id="value">${coinValue}</span>.</div>
      <div>Coins:</div>
      <ul id="coinList">
        ${
      coins
        .map((coin) => `<li>${coin.i}:${coin.j}#${coin.serial}</li>`)
        .join("")
    }
      </ul>
      <button id="collect">Collect Coin</button>
      <button id="deposit">Deposit Coin</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          cacheCoinValues.set(cacheKey, coinValue);

          // Add a new coin with a unique serial number
          const newCoin: Coin = { i: cell.i, j: cell.j, serial: coins.length };
          coins.push(newCoin);

          // Update coin list and display
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          const coinList = popupDiv.querySelector<HTMLUListElement>(
            "#coinList",
          )!;
          coinList.innerHTML +=
            `<li>${newCoin.i}:${newCoin.j}#${newCoin.serial}</li>`;

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
