import { Game } from './game.js';
import { Part } from './part.js';
import { Tile, setTileEmit } from './tile.js';
import { SimUpgrade } from './sim-upgrade.js';
import parts from '../data/parts.js';
import upgradesFactory from '../data/upgrades.js';

const cell_prefixes = ['', 'Dual ', 'Quad '];
const prefixes = ['Basic ', 'Advanced ', 'Super ', 'Wonderous ', 'Ultimate '];
const cell_power_multipliers = [1, 4, 12];
const cell_heat_multipliers = [1, 8, 36];
const cell_counts = [1, 2, 4, 9, 16];
const multi_cell_description =
  'Acts as %count %type cells. Produces %power power and %heat heat per tick.';

function createPart(game, partSettings, level = partSettings.level) {
  let part = partSettings;
  if (level) {
    part = Object.assign({}, partSettings);
    part.level = level;
    part.base_cost *= Math.pow(part.cost_multiplier || 1, level - 1);

    if (part.category === 'cell') {
      part.id = part.type + level;
      part.title = (cell_prefixes[level - 1] || '') + part.title;
      if (level > 1) {
        part.base_description = multi_cell_description;
      }
      part.power = part.base_power * cell_power_multipliers[level - 1];
      part.heat = part.base_heat * cell_heat_multipliers[level - 1];
      part.cell_count = cell_counts[level - 1];
      part.cell_multiplier = cell_power_multipliers[level - 1];
      part.pulse_multiplier = 1;
    } else {
      part.id = part.category + level;
      part.title = (prefixes[level - 1] || '') + part.title;

      if (part.base_ticks && part.ticks_multiplier) {
        part.base_ticks = part.base_ticks * Math.pow(part.ticks_multiplier, level - 1);
      }
      if (part.base_containment && part.containment_multiplier) {
        part.base_containment =
          part.base_containment * Math.pow(part.containment_multiplier, level - 1);
      }
      if (part.base_reactor_power && part.reactor_power_multiplier) {
        part.base_reactor_power =
          part.base_reactor_power * Math.pow(part.reactor_power_multiplier, level - 1);
      }
      if (part.base_reactor_heat && part.reactor_heat_multiplier) {
        part.base_reactor_heat =
          part.base_reactor_heat * Math.pow(part.reactor_heat_multiplier, level - 1);
      }
      if (part.base_transfer && part.transfer_multiplier) {
        part.base_transfer = part.base_transfer * Math.pow(part.transfer_multiplier, level - 1);
      }
      if (part.base_vent && part.vent_multiplier) {
        part.base_vent = part.base_vent * Math.pow(part.vent_multiplier, level - 1);
      }
      if (part.base_ep_heat && part.ep_heat_multiplier) {
        part.base_ep_heat = part.base_ep_heat * Math.pow(part.ep_heat_multiplier, level - 1);
      }
      if (part.base_power_increase && part.power_increase_add) {
        part.base_power_increase =
          part.base_power_increase + part.power_increase_add * level - 1;
      }
    }
  }

  const part_obj = new Part(part);
  part_obj.className = 'part_' + part.id;
  game.part_objects[part.id] = part_obj;
  game.part_objects_array.push(part_obj);
  return part_obj;
}

export function bootstrapSimGame() {
  setTileEmit(() => {});

  const game = new Game();
  game.parts = parts;
  game.ui = { say() {} };
  game.epart_onclick = function() {};
  game.onDimensionsChange = null;

  Part.prototype.updateDescription = function() {};

  for (let ri = 0; ri < game.max_rows; ri++) {
    const row = [];
    for (let ci = 0; ci < game.max_cols; ci++) {
      const tile = new Tile(ri, ci);
      row.push(tile);
      game.tiles_2d.push(tile);
    }
    game.tiles.push(row);
  }

  game.set_active_tiles(game.base_rows, game.base_cols);

  for (const partSettings of parts) {
    if (partSettings.levels) {
      for (let i = 0; i < partSettings.levels; i++) {
        createPart(game, partSettings, i + 1);
      }
    } else {
      createPart(game, partSettings);
    }
  }

  game.update_cell_power = function() {
    for (const part of game.part_objects_array) {
      if (part.category !== 'cell') continue;

      const infused = game.upgrade_objects['infused_cells']?.level || 0;
      const unleashed = game.upgrade_objects['unleashed_cells']?.level || 0;
      const cellPower = game.upgrade_objects['cell_power_' + part.part.type];

      if (cellPower) {
        const mult = (cellPower.level + infused + 1) * Math.pow(2, unleashed);
        part.base_power = part.part.base_power * mult;
        part.power = part.part.power * mult;
      } else {
        const mult = (infused + 1) * Math.pow(2, unleashed);
        part.base_power = part.part.base_power * mult;
        part.power = part.part.power * mult;
      }

      if (part.part.type === 'protium') {
        const unstable = game.upgrade_objects['unstable_protium']?.level || 0;
        const mult = (infused + 1) * Math.pow(2, unstable) * Math.pow(2, unleashed);
        part.base_power = part.part.base_power * mult;
        part.base_power *= 1 + (game._protium_particles || 0) / 10;
        part.power = part.base_power;
      }
    }
  };

  const upgradeDefs = upgradesFactory(game);
  for (const u of upgradeDefs) {
    u.levels = u.levels || game.upgrade_max_level;
    const upgrade = new SimUpgrade(u, game);
    game.upgrade_objects_array.push(upgrade);
    game.upgrade_objects[upgrade.upgrade.id] = upgrade;
  }

  for (const upgrade of game.upgrade_objects_array) {
    upgrade.setLevel(0);
  }

  return game;
}

export function createSimRuntime(initial = {}) {
  return {
    active_cells: [],
    current_power: initial.current_power ?? 0,
    max_heat: initial.max_heat ?? 1000,
    max_power: initial.max_power ?? 100,
    stat_vent: 0,
    stat_inlet: 0,
    stat_outlet: 0,
    transfer_multiplier: 0,
    vent_multiplier: 0,
    protium_particles: initial.protium_particles ?? 0,
  };
}

export function applySaveToSimGame(game, runtime, saveData, partObjects) {
  if (!saveData) return;

  game.current_heat = saveData.current_heat || 0;
  runtime.current_power = saveData.current_power || 0;
  game.current_money = saveData.current_money || 0;
  game.exotic_particles = saveData.exotic_particles || 0;
  game.current_exotic_particles = saveData.current_exotic_particles || 0;
  runtime.protium_particles = saveData.protium_particles || 0;
  game._protium_particles = runtime.protium_particles;

  if (saveData.active_tiles_2d) {
    game.set_active_tiles(saveData.active_tiles_2d.rows, saveData.active_tiles_2d.cols);
    for (const [i, stile] of saveData.active_tiles_2d.tiles.entries()) {
      if (stile) {
        const tile = game.active_tiles_2d[i];
        tile.setTicks(stile.ticks);
        tile.activated = stile.activated;
        tile.setHeat_contained(stile.heat_contained);
        tile.part = partObjects[stile.id] || game.part_objects[stile.id];
        tile.enabled = true;
      }
    }
  }

  if (saveData.upgrades) {
    for (const supgrade of saveData.upgrades) {
      const obj = game.upgrade_objects[supgrade.id];
      if (obj) obj.setLevel(supgrade.level);
    }
  }

  if (saveData.buttons_state) {
    if (saveData.buttons_state.paused !== undefined) game.paused = saveData.buttons_state.paused;
    if (saveData.buttons_state.time_flux !== undefined) game.time_flux = saveData.buttons_state.time_flux;
    if (saveData.buttons_state.auto_sell_disabled !== undefined) {
      game.auto_sell_disabled = saveData.buttons_state.auto_sell_disabled;
    }
    if (saveData.buttons_state.auto_buy_disabled !== undefined) {
      game.auto_buy_disabled = saveData.buttons_state.auto_buy_disabled;
    }
    if (saveData.buttons_state.heat_controlled !== undefined) {
      game.heat_controlled = saveData.buttons_state.heat_controlled;
    }
    if (saveData.buttons_state.heat_outlet_controlled !== undefined) {
      game.heat_outlet_controlled = saveData.buttons_state.heat_outlet_controlled;
    }
  }

  game.update_cell_power();
}

export function serializeSimState(game, runtime, extras = {}) {
  const stiles = game.active_tiles_2d.map((tile) =>
    tile.part
      ? {
          id: tile.part.id,
          ticks: tile.ticks,
          activated: tile.activated,
          heat_contained: tile.heat_contained,
        }
      : null
  );

  const supgrades = game.upgrade_objects_array.map((upgrade) => ({
    id: upgrade.upgrade.id,
    level: upgrade.level,
  }));

  return {
    active_tiles_2d: { rows: game.rows, cols: game.cols, tiles: stiles },
    upgrades: supgrades,
    current_power: runtime.current_power,
    current_money: game.current_money,
    current_heat: game.current_heat,
    exotic_particles: game.exotic_particles,
    current_exotic_particles: game.current_exotic_particles,
    protium_particles: runtime.protium_particles,
    ...extras,
  };
}
