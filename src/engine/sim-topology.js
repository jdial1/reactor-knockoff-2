import { get_tile_in_range, heat_exchanger6_range } from './heat-range.js';
import { setTileMultipliers } from './tile.js';

export function rebuildTopology(game, runtime) {
  let transfer_multiplier = 0;
  let vent_multiplier = 0;
  let max_power = game.altered_max_power;
  let max_heat = game.altered_max_heat;
  let total_heat = 0;
  game.stats_power = 0;

  runtime.active_cells.length = 0;

  let stat_vent = 0;
  let stat_inlet = 0;
  let stat_outlet = 0;
  let part_count = 0;

  for (const tile of game.active_tiles_2d) {
    if (tile.enabled === false) {
      if (tile.enable) tile.enable();
    }

    const tile_part = tile.part;

    tile.heat = 0;
    tile.power = 0;

    tile.containments.length = 0;
    tile.cells.length = 0;
    tile.reflectors.length = 0;

    if (tile_part && tile.activated) {
      part_count++;

      if (tile_part.vent) {
        stat_vent += tile_part.vent;
      }

      if (tile_part.category !== 'cell' || tile.ticks) {
        const tiles = tile_part.id === 'heat_exchanger6'
          ? heat_exchanger6_range(game, tile)
          : get_tile_in_range(game, tile, tile.part.range || 1);

        for (const tile2 of tiles) {
          if (tile2.part && tile2.activated) {
            if (tile2.part.containment) {
              if (tile.part.category === 'vent' || tile.part.id === 'coolant_cell6') {
                tile.containments.unshift(tile2);
              } else {
                tile.containments.push(tile2);
              }
            } else if (tile2.part.category === 'cell' && tile2.ticks !== 0) {
              tile.cells.push(tile2);
            } else if (tile2.part.category === 'reflector') {
              tile.reflectors.push(tile2);
            }
          }
        }
      }

      if (tile_part.category === 'capacitor') {
        transfer_multiplier += tile_part.part.level * game.transfer_capacitor_multiplier;
        vent_multiplier += tile_part.part.level * game.vent_capacitor_multiplier;
      } else if (tile_part.category === 'reactor_plating') {
        transfer_multiplier += tile_part.part.level * game.transfer_plating_multiplier;
        vent_multiplier += tile_part.part.level * game.vent_plating_multiplier;
      }

      if (tile_part.category === 'heat_inlet') {
        stat_inlet += tile_part.transfer * tile.containments.length;
      }

      if (tile_part.category === 'heat_outlet') {
        stat_outlet += tile_part.transfer * tile.containments.length;
      }

      if (tile_part.category === 'cell') {
        runtime.active_cells.push(tile);
      }

      if (tile_part.reactor_power) {
        max_power += tile_part.reactor_power;
      }

      if (tile_part.reactor_heat) {
        max_heat += tile_part.reactor_heat;
      }

      if (tile_part.id === 'reactor_plating6') {
        max_power += tile_part.reactor_heat;
      }
    }
  }

  for (const tile of runtime.active_cells) {
    const tile_part = tile.part;

    if (tile.cells.length) {
      let pulses = 0;
      for (const tile2 of tile.cells) {
        pulses += tile2.part.pulses;
      }

      tile.heat += tile_part.base_heat * Math.pow(tile_part.part.cell_multiplier + pulses, 2) / tile_part.cell_count;
      tile.power += tile_part.base_power * (tile_part.part.cell_multiplier + pulses);
    } else {
      tile.heat += tile_part.heat;
      tile.power += tile_part.power;
    }

    if (tile.reflectors.length) {
      let tile_power_mult = 0;
      let tile_heat_mult = 0;

      for (const tile_reflector of tile.reflectors) {
        tile_power_mult += tile_reflector.part.power_increase;

        if (tile_reflector.part.heat_increase) {
          tile_heat_mult += tile_reflector.part.heat_increase;
        }
      }

      tile.power += tile.power * (tile_power_mult / 100);
      tile.heat += tile.heat * (tile_heat_mult / 100);
    }

    tile.display_heat = tile.heat;
    tile.display_power = tile.power;

    total_heat += tile.heat;
    game.stats_power += tile.power;

    if (tile.containments.length) {
      const heat_remove = Math.ceil(tile.heat / tile.containments.length);

      for (const tile_containment of tile.containments) {
        tile.heat -= heat_remove;
        tile_containment.heat += heat_remove;
      }
    }
  }

  stat_vent *= (1 + vent_multiplier / 100);
  stat_inlet *= (1 + transfer_multiplier / 100);
  stat_outlet *= (1 + transfer_multiplier / 100);

  runtime.transfer_multiplier = transfer_multiplier;
  runtime.vent_multiplier = vent_multiplier;
  runtime.max_power = max_power;
  runtime.max_heat = max_heat;
  runtime.stat_vent = stat_vent;
  runtime.stat_inlet = stat_inlet;
  runtime.stat_outlet = stat_outlet;

  setTileMultipliers(transfer_multiplier, vent_multiplier);

  const stats = {
    max_power,
    max_heat,
    stats_vent: stat_vent,
    stats_inlet: stat_inlet,
    stats_outlet: stat_outlet,
    stats_heat: total_heat,
    total_power: game.stats_power,
    stats_cash: Math.ceil(max_power * game.auto_sell_multiplier),
  };

  if (part_count === 0 && runtime.current_power + game.current_money < game.base_money) {
    game.current_money = game.base_money - runtime.current_power;
    stats.current_money = game.current_money;
  }

  game.stats_cash = stats.stats_cash;

  return stats;
}
