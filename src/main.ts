// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Anchor point at Null Island
const _NULL_ISLAND = leaflet.latLng(0, 0);
const TILE_DEGREES = 1e-4;
const GAMEPLAY_ZOOM_LEVEL = 19;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

// Location of Oakes College classroom
const OAKES_CLASSROOM = leaflet.latLng(36.98949379578401, -122.06277128548504);

// Initialize the board with tile and radius settings
const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);

const map = leaflet.map(document.getElementById("map")!, {
  center: OAKES_CLASSROOM,
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

const playerMarker = leaflet.marker(OAKES_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

// Store cache coin values in a global map
const cacheCoinValues = new Map<string, number>();
const coinSerials = new Map<string, number>();

function getCacheKey(i: number, j: number): string {
  return `${i},${j}`;
}

function spawnCache(i: number, j: number) {
  const bounds = board.getCellBounds({ i, j });
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  const cacheKey = getCacheKey(i, j);
  if (!cacheCoinValues.has(cacheKey)) {
    cacheCoinValues.set(
      cacheKey,
      Math.floor(luck([i, j, "initialValue"].toString()) * 100),
    );
  }
  if (!coinSerials.has(cacheKey)) {
    coinSerials.set(cacheKey, 0);
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
          const serial = coinSerials.get(cacheKey)!;
          const coinId = `${i}:${j}#${serial}`;
          coinSerials.set(cacheKey, serial + 1);
          coinValue--;
          playerCoins++;
          cacheCoinValues.set(cacheKey, coinValue);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML =
            `${playerCoins} coins accumulated (Last collected: ${coinId})`;
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

// Spawn caches in the vicinity
const originCell = board.getCellForPoint(OAKES_CLASSROOM);
for (
  let i = originCell.i - NEIGHBORHOOD_SIZE;
  i <= originCell.i + NEIGHBORHOOD_SIZE;
  i++
) {
  for (
    let j = originCell.j - NEIGHBORHOOD_SIZE;
    j <= originCell.j + NEIGHBORHOOD_SIZE;
    j++
  ) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}

// Track player's current cell and position
let playerCell = board.getCellForPoint(OAKES_CLASSROOM);
let playerLatLng = board.getCellBounds(playerCell).getCenter();

// Update player marker position and recenter map
function updatePlayerPosition(cell: Cell) {
  playerCell = cell;
  playerLatLng = board.getCellBounds(playerCell).getCenter();
  playerMarker.setLatLng(playerLatLng);
  map.setView(playerLatLng);
}

// Move player in a specified direction
function movePlayer(di: number, dj: number) {
  const newCell = board.getCanonicalCell({
    i: playerCell.i + di,
    j: playerCell.j + dj,
  });
  updatePlayerPosition(newCell);
}

// Directional button event listeners
document.getElementById("north")?.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("south")?.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("east")?.addEventListener(
  "click",
  () => movePlayer(0, 1),
);
document.getElementById("west")?.addEventListener(
  "click",
  () => movePlayer(0, -1),
);

// Reset button to return player to the Oakes College classroom
document.getElementById("reset")?.addEventListener(
  "click",
  () => updatePlayerPosition(originCell),
);
