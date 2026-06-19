import { removePartSim, pruneTileQueue } from './placement-sim.js';

let _deps;

export function removePartDom(tile, part_replace, category_replace) {
  tile.$el.classList.remove('spent', 'disabled');
  tile.$el.className = tile.$el.className
    .replace(part_replace, '')
    .replace(category_replace, '');
}

export function createPlacement(deps) {
  _deps = deps;

  var part_replace = /[\b\s]part_[a-z0-9_]+\b/;
  var category_replace = /[\b\s]category_[a-z_]+\b/;
  var rpl;
  var rpqi;
  var tile2;
  var tile;

  var apply_to_tile = function(tile, part, force) {
    if (!tile.enabled && !force) {
      return;
    }

    const prevPart = tile.part;
    tile.part = part;
    tile.$el.classList.remove('spent', 'disabled', 'exploding');
    tile.$el.className = tile.$el.className
      .replace(part_replace, '')
      .replace(category_replace, '')
      + ' ' + part.className
      + ' category_' + part.category;

    if (part.ticks) {
      if (!tile.ticks) {
        tile.$el.classList.add('spent');
      }
    }

    if (!tile.activated) {
      tile.$el.classList.add('disabled');
    }

    if (part && prevPart !== part) {
      tile.$el.classList.remove('tile-placed');
      void tile.$el.offsetWidth;
      tile.$el.classList.add('tile-placed');
      window.setTimeout(() => tile.$el.classList.remove('tile-placed'), 420);
    }
  };

  var remove_part = function(remove_tile, skip_update = false, sell = false) {
    removePartSim(remove_tile, _deps.game, {
      sell,
      onMoneyChange: (m) => _deps.ui.say('var', 'current_money', m),
    });

    removePartDom(remove_tile, part_replace, category_replace);

    if (!skip_update) {
      _deps.update_tiles();
    }

    pruneTileQueue(_deps.tile_queue);
  };

  var part_replaceable = function(part) {
    if (_deps.clicked_part) {
      if (!part) return 1;
      else if (part === _deps.clicked_part) return 2;
      else if (part.part.category === _deps.clicked_part.part.category) return 3;
    }
    return 0;
  };

  var tile_replaceable = function(tile) {
    return part_replaceable(tile.part, tile);
  };

  var bulkEditDepth = 0;

  var beginBulkEdit = function() {
    bulkEditDepth += 1;
  };

  var endBulkEdit = function() {
    bulkEditDepth = Math.max(0, bulkEditDepth - 1);
    if (bulkEditDepth === 0 && _deps.workerBridge) {
      _deps.workerBridge.syncFromMain();
    }
  };

  var mouse_apply_to_tile = function(e, skip_update = false, part_replacement_result) {
    var skip_replaceable_check = part_replacement_result !== undefined;
    tile = this.tile;

    if (_deps.tile_mousedown_right) {
      remove_part(tile, skip_update, true);
    } else if (
      _deps.clicked_part
      && (skip_replaceable_check || (part_replacement_result = tile_replaceable(tile)))
      && (part_replacement_result !== 2 || tile.activated === false || tile.ticks === 0)
      && (part_replacement_result !== 3 || _deps.game.current_money >= _deps.clicked_part.cost)
    ) {
      remove_part(tile, true, true);
      if (_deps.game.current_money < _deps.clicked_part.cost) {
        tile.activated = false;
        _deps.tile_queue.push(tile);
      } else {
        tile.activated = true;
        _deps.game.current_money -= _deps.clicked_part.cost;
        _deps.ui.say('var', 'current_money', _deps.game.current_money);
      }

      tile.setTicks(_deps.clicked_part.ticks);

      apply_to_tile(tile, _deps.clicked_part);

      if (!skip_update) {
        _deps.update_tiles();
      }
    }

    if (_deps.workerBridge && bulkEditDepth === 0) {
      _deps.workerBridge.syncFromMain();
    }
  };

  return {
    apply_to_tile,
    remove_part,
    removePartDom: (t) => removePartDom(t, part_replace, category_replace),
    part_replaceable,
    tile_replaceable,
    mouse_apply_to_tile,
    beginBulkEdit,
    endBulkEdit,
    part_replace,
    category_replace,
  };
}
