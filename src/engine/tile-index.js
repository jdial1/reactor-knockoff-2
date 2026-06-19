export function tileIndex(tile, maxCols) {
  return tile.row * maxCols + tile.col;
}

export function tileByIndex(game, index) {
  const row = Math.floor(index / game.max_cols);
  const col = index % game.max_cols;
  return game.tiles[row][col];
}
