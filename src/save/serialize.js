export function createSerialize(game, getState) {
  return function saves() {
    const {
      current_power,
      total_exotic_particles,
      protium_particles,
      current_objective,
      last_tick_time,
      tile_queue,
    } = getState();

    const stiles = game.active_tiles_2d.map((tile) => tile.part ?
      { id: tile.part.id, ticks: tile.ticks, activated: tile.activated, heat_contained: tile.heat_contained } : null);

    const squeue = tile_queue.map((tile) => ({ row: tile.row, col: tile.col }));

    const supgrades = game.upgrade_objects_array.map((upgrade) => ({ id: upgrade.upgrade.id, level: upgrade.level }));

    return window.btoa(JSON.stringify({
      active_tiles_2d: { rows: game.rows, cols: game.cols, tiles: stiles },
      tile_queue: squeue,
      upgrades: supgrades,
      current_power,
      current_money: game.current_money,
      current_heat: game.current_heat,
      exotic_particles: game.exotic_particles,
      current_exotic_particles: game.current_exotic_particles,
      total_exotic_particles,
      buttons_state: game.ui.toggle_buttons_saves(),
      protium_particles,
      current_objective,
      last_tick_time,
      offline_tick: game.offline_tick,
      version: game.version,
    }));
  };
}

export function createLoad(game, ui, getState, setState, deps) {
  return function loads(rks) {
    game.save_debug && console.log('save_game.load', rks);
    deps.set_defaults();

    const state = getState();

    if (rks) {
      try {
        rks = JSON.parse(window.atob(rks));
      } catch (err) {
        rks = {};
      }

      game.current_heat = rks.current_heat || game.current_heat;
      state.current_power = rks.current_power || state.current_power;
      game.current_money = rks.current_money || 0;
      game.exotic_particles = rks.exotic_particles || game.exotic_particles;
      game.current_exotic_particles = rks.current_exotic_particles || game.current_exotic_particles;
      state.total_exotic_particles = rks.total_exotic_particles || state.total_exotic_particles;
      ui.say('var', 'total_exotic_particles', state.total_exotic_particles);

      state.max_heat = rks.max_heat || state.max_heat;
      game.manual_heat_reduce = rks.manual_heat_reduce || game.manual_heat_reduce;
      game.paused = rks.paused || game.paused;
      state.current_objective = rks.current_objective || state.current_objective;

      state.protium_particles = rks.protium_particles || state.protium_particles;

      if (rks.offline_tick === false || !game.offline_tick) {
        state.last_tick_time = null;
      } else {
        state.last_tick_time = rks.last_tick_time || state.last_tick_time;
      }

      const save_version = rks.version || null;

      if (rks.buttons_state) {
        ui.toggle_buttons_loads(rks.buttons_state);
      }

      ui.say('var', 'manual_heat_reduce', game.manual_heat_reduce);
      ui.say('var', 'auto_heat_reduce', state.max_heat / 10000);

      if (rks.tiles) {
        for (let ri = 0; ri < game.max_rows; ri++) {
          const row = game.tiles[ri];
          const srow = rks.tiles[ri];

          if (srow) {
            for (let ci = 0; ci < game.max_cols; ci++) {
              const stile = srow[ci];

              if (stile) {
                const tile = row[ci];
                tile.setTicks(stile.ticks);
                tile.activated = stile.activated;
                tile.setHeat_contained(stile.heat_contained);
                const part = game.part_objects[stile.id];
                deps.apply_to_tile(tile, part, true);
              }
            }
          }
        }
      }

      if (rks.active_tiles_2d) {
        game.set_active_tiles(rks.active_tiles_2d.rows, rks.active_tiles_2d.cols);
        for (const [i, stile] of rks.active_tiles_2d.tiles.entries()) {
          if (stile) {
            const tile = game.active_tiles_2d[i];
            tile.setTicks(stile.ticks);
            tile.activated = stile.activated;
            tile.setHeat_contained(stile.heat_contained);
            const part = game.part_objects[stile.id];
            deps.apply_to_tile(tile, part, true);
          }
        }
      }

      if (rks.tile_queue) {
        for (const stile of rks.tile_queue) {
          state.tile_queue.push(game.tiles[stile.row][stile.col]);
        }
      }

      if (rks.upgrades) {
        for (const supgrade of rks.upgrades) {
          const supgrade_object = game.upgrade_objects[supgrade.id];

          if (supgrade_object) {
            game.upgrade_objects[supgrade.id].setLevel(supgrade.level);
          }
        }
      }

      deps.update_nodes();
      deps.update_tiles();
      deps.update_heat_and_power();

      if (save_version !== game.version) {
        ui.say('evt', 'game_updated');
      }
    }

    game.update_cell_power();
    deps.update_nodes();
    deps.update_tiles();
    deps.update_heat_and_power();

    if (!game.paused) {
      clearTimeout(state.loop_timeout);
      state.loop_timeout = setTimeout(deps.game_loop, game.loop_wait);
    }

    deps.set_objective(state.current_objective, true);

    ui.say('evt', 'game_loaded');

    if (deps.reinitWorker) {
      deps.reinitWorker();
    }

    if (game.debug === false) {
      state.save_timeout = setTimeout(deps.save, game.save_interval);
    }
  };
}
