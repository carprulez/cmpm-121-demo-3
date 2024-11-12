// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// Coordinates for the Oakes College classroom
const OAKES_COLLEGE_LAT = 36.98949379578401;
const OAKES_COLLEGE_LNG = -122.06277128548504;
const TILE_DEGREES = 1e-4;
const GAMEPLAY_ZOOM_LEVEL = 19;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: [OAKES_COLLEGE_LAT, OAKES_COLLEGE_LNG],
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

const playerMarker = leaflet.marker([OAKES_COLLEGE_LAT, OAKES_COLLEGE_LNG]);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "No coins yet...";

const board = new Board(TILE_DEGREES, NEIGHBORHOOD_SIZE);
const _cacheCoinValues = new Map<string, number>();

interface Memento<T> {
  toMemento(): T;
  fromMemento(memento: T): void;
}

class Geocache implements Memento<string> {
  i: number;
  j: number;
  numCoins: number;
  serial: number;

  constructor(i: number, j: number, numCoins: number, serial: number) {
    this.i = i;
    this.j = j;
    this.numCoins = numCoins;
    this.serial = serial;
  }

  toMemento(): string {
    return JSON.stringify({ numCoins: this.numCoins });
  }

  fromMemento(memento: string): void {
    const data = JSON.parse(memento);
    this.numCoins = data.numCoins;
  }
}

// Map to store caches with unique serials
const cacheMap = new Map<string, Geocache>();

function getCacheKey(i: number, j: number): string {
  return `${i},${j}`;
}

function spawnCache(cell: Cell) {
  const cacheKey = getCacheKey(cell.i, cell.j);
  if (!cacheMap.has(cacheKey)) {
    const numCoins = Math.floor(
      luck([cell.i, cell.j, "initialValue"].toString()) * 100,
    );
    const cache = new Geocache(cell.i, cell.j, numCoins, cacheMap.size);
    cacheMap.set(cacheKey, cache);
  }

  const cache = cacheMap.get(cacheKey)!;
  const bounds = board.getCellBounds(cell);
  const rect = leaflet.rectangle(bounds);
  rect.addTo(map);

  rect.bindPopup(() => {
    let coinValue = cache.numCoins;

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>Cache at "${cell.i},${cell.j}". Value: <span id="value">${coinValue}</span>.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>`;

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          cache.numCoins = coinValue;
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
          cache.numCoins = coinValue;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML = `${playerCoins} coins accumulated`;
        }
      },
    );

    return popupDiv;
  });
}

function updateVisibleCaches() {
  map.eachLayer((layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  const nearbyCells = board.getCellsNearPoint(playerMarker.getLatLng());
  nearbyCells.forEach((cell) => {
    if (luck([cell.i, cell.j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell);
    }
  });
}

function movePlayer(di: number, dj: number) {
  const currentCell = board.getCellForPoint(playerMarker.getLatLng());
  const newCell = { i: currentCell.i - di, j: currentCell.j - dj }; // Flip signs here to adjust the direction
  const newLatLng = board.getCellBounds(newCell).getCenter();

  playerMarker.setLatLng(newLatLng);
  map.setView(newLatLng, GAMEPLAY_ZOOM_LEVEL);
  updateVisibleCaches();
}

document.getElementById("north")!.addEventListener(
  "click",
  () => movePlayer(-1, 0),
);
document.getElementById("south")!.addEventListener(
  "click",
  () => movePlayer(1, 0),
);
document.getElementById("west")!.addEventListener(
  "click",
  () => movePlayer(0, 1),
);
document.getElementById("east")!.addEventListener(
  "click",
  () => movePlayer(0, -1),
);

updateVisibleCaches();
