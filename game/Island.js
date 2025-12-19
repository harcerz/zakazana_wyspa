// Island tiles management
const { TILE_STATE, ISLAND_TILES, ISLAND_LAYOUT } = require('./constants');

class Island {
  constructor() {
    this.tiles = [];
    this.grid = [];
    this.initialize();
  }

  initialize() {
    // Shuffle tiles
    const shuffledTiles = this.shuffleArray([...ISLAND_TILES]);

    // Create tile objects
    this.tiles = shuffledTiles.map((tileDef, index) => ({
      ...tileDef,
      index,
      state: TILE_STATE.NORMAL,
      row: -1,
      col: -1
    }));

    // Place tiles on grid according to layout
    this.grid = [];
    let tileIndex = 0;

    for (let row = 0; row < 6; row++) {
      this.grid[row] = [];
      for (let col = 0; col < 6; col++) {
        const layoutIndex = ISLAND_LAYOUT[row][col];
        if (layoutIndex !== null) {
          const tile = this.tiles[tileIndex];
          tile.row = row;
          tile.col = col;
          this.grid[row][col] = tile;
          tileIndex++;
        } else {
          this.grid[row][col] = null;
        }
      }
    }
  }

  shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  getTileById(id) {
    return this.tiles.find(t => t.id === id);
  }

  getTileAt(row, col) {
    if (row < 0 || row >= 6 || col < 0 || col >= 6) return null;
    return this.grid[row][col];
  }

  getTileByStartingRole(roleId) {
    return this.tiles.find(t => t.starting === roleId);
  }

  getHelipad() {
    return this.tiles.find(t => t.isHelipad);
  }

  getArtifactTiles(artifactId) {
    return this.tiles.filter(t => t.artifact === artifactId && t.state !== TILE_STATE.SUNK);
  }

  floodTile(tileId) {
    const tile = this.getTileById(tileId);
    if (!tile) return { success: false, message: 'Pole nie istnieje' };

    if (tile.state === TILE_STATE.NORMAL) {
      tile.state = TILE_STATE.FLOODED;
      return { success: true, flooded: true, sunk: false, tile };
    } else if (tile.state === TILE_STATE.FLOODED) {
      tile.state = TILE_STATE.SUNK;
      this.grid[tile.row][tile.col] = null;
      return { success: true, flooded: false, sunk: true, tile };
    }
    return { success: false, message: 'Pole jest już zatopione' };
  }

  shoreUp(tileId) {
    const tile = this.getTileById(tileId);
    if (!tile) return { success: false, message: 'Pole nie istnieje' };

    if (tile.state === TILE_STATE.FLOODED) {
      tile.state = TILE_STATE.NORMAL;
      return { success: true, tile };
    }
    return { success: false, message: 'Pole nie jest zalane' };
  }

  getAdjacentTiles(row, col, includeDiagonal = false) {
    const adjacent = [];
    const directions = [
      [-1, 0], [1, 0], [0, -1], [0, 1] // up, down, left, right
    ];

    if (includeDiagonal) {
      directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    }

    for (const [dr, dc] of directions) {
      const tile = this.getTileAt(row + dr, col + dc);
      if (tile && tile.state !== TILE_STATE.SUNK) {
        adjacent.push(tile);
      }
    }
    return adjacent;
  }

  getValidMoves(row, col, role = null) {
    // Special case for diver
    if (role === 'diver') {
      return this.getDiverMoves(row, col);
    }

    const includeDiagonal = role === 'explorer';
    return this.getAdjacentTiles(row, col, includeDiagonal);
  }

  getDiverMoves(startRow, startCol) {
    // Diver can swim through flooded or sunk tiles to reach the nearest non-sunk tile
    const visited = new Set();
    const validMoves = [];
    const queue = [[startRow, startCol, 0]];

    while (queue.length > 0) {
      const [row, col, dist] = queue.shift();
      const key = `${row},${col}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const tile = this.getTileAt(row, col);

      // If it's a valid tile (not the start and not sunk), add to moves
      if (dist > 0 && tile && tile.state !== TILE_STATE.SUNK) {
        validMoves.push(tile);
      }

      // Continue exploring through flooded/sunk tiles
      const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      for (const [dr, dc] of directions) {
        const newRow = row + dr;
        const newCol = col + dc;
        const newKey = `${newRow},${newCol}`;

        if (!visited.has(newKey) && newRow >= 0 && newRow < 6 && newCol >= 0 && newCol < 6) {
          const checkTile = this.grid[newRow]?.[newCol];
          // Diver can pass through where tiles used to be (null) or flooded tiles
          if (checkTile === null || (checkTile && checkTile.state !== TILE_STATE.NORMAL)) {
            queue.push([newRow, newCol, dist + 1]);
          } else if (checkTile && checkTile.state === TILE_STATE.NORMAL) {
            // Can move to normal tile but not through it
            if (!visited.has(newKey)) {
              validMoves.push(checkTile);
              visited.add(newKey);
            }
          }
        }
      }
    }

    return validMoves;
  }

  getShoreUpTargets(row, col, role = null) {
    const targets = [];

    // Can shore up own tile
    const ownTile = this.getTileAt(row, col);
    if (ownTile && ownTile.state === TILE_STATE.FLOODED) {
      targets.push(ownTile);
    }

    // Adjacent tiles
    const includeDiagonal = role === 'explorer';
    const adjacent = this.getAdjacentTiles(row, col, includeDiagonal);

    for (const tile of adjacent) {
      if (tile.state === TILE_STATE.FLOODED) {
        targets.push(tile);
      }
    }

    return targets;
  }

  getAllFloodedTiles() {
    return this.tiles.filter(t => t.state === TILE_STATE.FLOODED);
  }

  getAllNonSunkTiles() {
    return this.tiles.filter(t => t.state !== TILE_STATE.SUNK);
  }

  getState() {
    return {
      tiles: this.tiles.map(t => ({
        id: t.id,
        name: t.name,
        state: t.state,
        row: t.row,
        col: t.col,
        artifact: t.artifact,
        starting: t.starting,
        isHelipad: t.isHelipad
      })),
      grid: this.grid.map(row =>
        row.map(tile => tile ? tile.id : null)
      )
    };
  }
}

module.exports = Island;
