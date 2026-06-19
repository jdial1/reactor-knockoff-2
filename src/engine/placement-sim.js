export function removePartSim(remove_tile, game, options = {}) {
  const { sell = false, onMoneyChange } = options;

  if (sell && remove_tile.activated && remove_tile.part && remove_tile.part.category !== 'cell') {
    if (remove_tile.part.ticks) {
      game.current_money += Math.ceil(
        remove_tile.part.ticks / remove_tile.ticks * remove_tile.part.cost
      );
    } else if (remove_tile.part.containment) {
      game.current_money += remove_tile.part.cost - Math.ceil(
        remove_tile.heat_contained / remove_tile.part.containment * remove_tile.part.cost
      );
    } else {
      game.current_money += remove_tile.part.cost;
    }
    if (onMoneyChange) onMoneyChange(game.current_money);
  }

  remove_tile.part = null;
  remove_tile.setTicks(0);
  remove_tile.setHeat_contained(0);
  remove_tile.updated = true;
}

export function pruneTileQueue(tile_queue) {
  for (let i = 0; i < tile_queue.length; i++) {
    if (!tile_queue[i].part) {
      tile_queue.splice(i, 1);
      i--;
    }
  }
}
