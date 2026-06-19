var ri;
var ci;
var row;
var tile;

var equal_filter = function(tile) {
  var part = tile.part;
  return function* (g) {
    for (var t of g) {
      if (part === t.part) {
        yield t;
      }
    }
  };
};

var replacer = function* (part) {
  for (ri = 0; ri < hotkeys.game.rows; ri++) {
    row = hotkeys.game.tiles[ri];
    for (ci = 0; ci < hotkeys.game.cols; ci++) {
      tile = row[ci];
      if (part === tile.part) {
        yield tile;
      }
    }
  }
};

var remover = function* (part, ticks) {
  for (ri = 0; ri < hotkeys.game.rows; ri++) {
    row = hotkeys.game.tiles[ri];
    for (ci = 0; ci < hotkeys.game.cols; ci++) {
      tile = row[ci];
      if (part === tile.part && (!tile.part.part.base_ticks || ticks || !tile.ticks)) {
        yield tile;
      }
    }
  }
};

var checker = function* (tile) {
  var placement = !((tile.row % 2) ^ (tile.col % 2));
  for (ri = 0; ri < hotkeys.game.rows; ri++) {
    var toggle = placement;
    row = hotkeys.game.tiles[ri];
    for (ci = 0; ci < hotkeys.game.cols; ci++) {
      if (toggle) {
        yield row[ci];
      }
      toggle = !toggle;
    }
    placement = !placement;
  }
};

var skip = 1;

var _row = function* (tile, start, i) {
  row = hotkeys.game.tiles[tile.row];
  for (ci = start; ci < hotkeys.game.cols; ci += i) {
    yield row[ci];
  }
};

var _column = function* (tile, start, i) {
  for (ri = start; ri < hotkeys.game.rows; ri += i) {
    row = hotkeys.game.tiles[ri];
    yield row[tile.col];
  }
};

class Hotkeys {
  constructor() {
    this.game;
  }

  init(game) {
    this.game = game;
  }

  replacer = replacer;
  remover = remover;
  checker = checker;
  row = (tile) => equal_filter(tile)(_row(tile, tile.col % skip, skip));
  shift_row = (tile) => _row(tile, tile.col % skip, skip);
  column = (tile) => equal_filter(tile)(_column(tile, tile.row % skip, skip));
  shift_column = (tile) => _column(tile, tile.row % skip, skip);
}

const hotkeys = new Hotkeys();

export function getMacroSkip() {
  return skip;
}

export function setMacroSkip(value) {
  skip = Math.max(1, Math.min(9, value | 0)) || 1;
}

window.addEventListener('keydown', function(event) {
  var key;
  var r = /Digit([2-9])/.exec(event.code);
  if (!event.repeat && r && (key = r[1])) {
    if (event.ctrlKey || event.altKey) {
      event.preventDefault();
    }

    skip = parseInt(key);
  }
});

window.addEventListener('keyup', function(event) {
  var key;
  var r = /Digit([2-9])/.exec(event.code);
  if (!event.repeat && r && (key = r[1])) {
    if (event.ctrlKey || event.altKey) {
      event.preventDefault();
    }

    if (parseInt(key) === skip) {
      skip = 1;
    }
  }
});

export default hotkeys;
