export function* get_tile_in_range(game, tile, x) {
  var i;
  var row;
  var col;
  var tile2;

  for (i = x; i > 0; i--) {
    row = game.tiles[tile.row - i];
    if (row) {
      for (col = tile.col + i - x; col <= tile.col - i + x; col++) {
        tile2 = row[col];
        if (tile2) {
          yield tile2;
        }
      }
    }
  }

  row = game.tiles[tile.row];
  for (col = tile.col - x; col < tile.col; col++) {
    tile2 = row[col];
    if (tile2) {
      yield tile2;
    }
  }

  for (col = tile.col + 1; col < tile.col + x + 1; col++) {
    tile2 = row[col];
    if (tile2) {
      yield tile2;
    }
  }

  for (i = 1; i < x + 1; i++) {
    row = game.tiles[tile.row + i];
    if (row) {
      for (col = tile.col + i - x; col <= tile.col - i + x; col++) {
        tile2 = row[col];
        if (tile2) {
          yield tile2;
        }
      }
    }
  }
}

export function* heat_exchanger6_range(game, tile) {
  if (tile.row - 1 >= 0) yield game.tiles[tile.row - 1][tile.col];
  yield* game.tiles[tile.row].slice(0, tile.col);
  yield* game.tiles[tile.row].slice(tile.col + 1);
  if (tile.row + 1 <= game.max_rows) yield game.tiles[tile.row + 1][tile.col];
}
