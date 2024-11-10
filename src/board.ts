import leaflet from "leaflet";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number; // Each tile's width in degrees
  readonly tileVisibilityRadius: number; // Radius (in cells) around a point to search for visible tiles

  private readonly knownCells: Map<string, Cell>; // Stores unique cells by key

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.knownCells = new Map();
  }

  // Ensures only one instance of each unique cell is created and stored
  public getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    if (!this.knownCells.has(key)) {
      // Store the new cell instance if it doesn't already exist
      this.knownCells.set(key, { i, j });
    }
    return this.knownCells.get(key)!;
  }

  // Converts a point (LatLng) into a cell based on the tile width
  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);

    return this.getCanonicalCell({ i, j });
  }

  // Returns the bounds of a specific cell as a LatLngBounds object
  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;

    const southWest = leaflet.latLng(i * this.tileWidth, j * this.tileWidth);
    const northEast = leaflet.latLng(
      (i + 1) * this.tileWidth,
      (j + 1) * this.tileWidth,
    );

    return leaflet.latLngBounds(southWest, northEast);
  }

  // Returns all cells within the visibility radius of a given point
  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);

    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const nearbyCell = this.getCanonicalCell({
          i: originCell.i + di,
          j: originCell.j + dj,
        });
        resultCells.push(nearbyCell);
      }
    }

    return resultCells;
  }
}
