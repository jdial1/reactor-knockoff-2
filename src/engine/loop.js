import { rebuildTopology } from './sim-topology.js';
import { removePartSim, pruneTileQueue } from './placement-sim.js';
import { tileIndex } from './tile-index.js';
import {
  createTickResult,
  setStat,
  pushVisualClass,
  pushPartRemoved,
  pushTileDiff,
} from './tick-result.js';

let _deps;

export function createLoop(deps) {
  _deps = deps;

  var loop_timeout;
  var was_melting_down = false;
  var heat_add_next_loop = 0;

  var active_inlets = [];
  var active_exchangers = [];
  var active_outlets = [];
  var active_extreme_capacitor = [];

  var dtime = 0;
  var last_tick_time;
  var last_data_set = [];
  var current_data_set = [];

  var loop_timing = 0;
  var tile;

  var trackTile = function(result, t, fields) {
    pushTileDiff(result, tileIndex(t, _deps.game.max_cols), fields);
  };

  var onMoneyChange = function(result, value) {
    setStat(result, 'current_money', value);
  };

  var check_offline_tick_safe = function() {
    current_data_set.length = 0;
    for (tile of _deps.game.active_tiles_2d) {
      current_data_set.push(tile.heat_contained);
    }

    [last_data_set, current_data_set] = [current_data_set, last_data_set];

    if (
      last_data_set.length === current_data_set.length &&
      last_data_set.every((v, i) => current_data_set[i] >= v) &&
      (game_stat_prediction.heat_remove + game_stat_prediction.reduce_heat) >=
        (game_stat_prediction.heat_add + game_stat_prediction.heat_add_next_loop)
    ) {
      return true;
    }
  };

  var offline_ticks = function(ticks) {
    const result = createTickResult();
    _deps.game.current_heat += game_stat_prediction.heat_add * ticks;
    _deps.game.current_heat += game_stat_prediction.heat_add_next_loop * ticks;
    _deps.game.current_heat -= game_stat_prediction.heat_remove * ticks;
    _deps.game.current_heat -= game_stat_prediction.reduce_heat * ticks;
    _deps.runtime.current_power += game_stat_prediction.power_add * ticks;
    _deps.runtime.current_power -= game_stat_prediction.sell_amount * ticks;
    _deps.game.current_money += game_stat_prediction.sell_amount * ticks;

    let ep_chance = game_stat_prediction.ep_chance_add * ticks;
    let ep_gain;

    if (ep_chance > 1) {
      ep_gain = Math.floor(ep_chance);
      ep_chance -= ep_gain;
    }

    if (ep_chance > Math.random()) {
      ep_gain++;
    }

    if (ep_gain > 0) {
      _deps.game.exotic_particles += ep_gain;
      setStat(result, 'exotic_particles', _deps.game.exotic_particles);
    }

    if (_deps.runtime.current_power > _deps.runtime.max_power) {
      _deps.runtime.current_power = _deps.runtime.max_power;
    }

    if (_deps.game.current_heat < 0) {
      _deps.game.current_heat = 0;
    }

    setStat(result, 'current_heat', _deps.game.current_heat);
    setStat(result, 'current_power', _deps.runtime.current_power);
    _deps.onTickResult(result);
  };

  var game_loop = function() {
    if (!last_tick_time) {
      last_tick_time = new Date().getTime();
    }

    let now = new Date().getTime();

    let tick = _deps.game.loop_wait;

    dtime += now - last_tick_time;
    last_tick_time = now;

    let amount_of_ticks = dtime / tick;

    _game_loop();
    amount_of_ticks -= 1;
    dtime -= tick;

    const fluxResult = createTickResult();
    setStat(fluxResult, 'flux_tick_time', dtime);
    _deps.onTickResult(fluxResult);

    if (amount_of_ticks > 1 && _deps.game.time_flux) {
      tick = 10;
    }

    if (!_deps.game.paused) {
      clearTimeout(loop_timeout);
      loop_timeout = setTimeout(game_loop, tick);
    }
  };

  var game_stat_prediction = {};
  game_stat_prediction.heat_add = 0;
  game_stat_prediction.heat_add_next_loop = 0;
  game_stat_prediction.heat_remove = 0;
  game_stat_prediction.reduce_heat = 0;
  game_stat_prediction.power_add = 0;
  game_stat_prediction.sell_amount = 0;

  var _game_loop = function() {
    let loop_start = performance.now();
    const tickResult = createTickResult();
    let power_add = 0;
    let heat_add = 0;
    let heat_remove = 0;
    let reduce_heat = 0;
    let sell_amount = 0;
    let ep_chance_add = 0;
    let meltdown = false;
    let do_update = false;
    let melting_down = false;
    let no_change_ticks = Infinity;

    active_inlets.length = 0;
    active_exchangers.length = 0;
    active_outlets.length = 0;
    active_extreme_capacitor.length = 0;

    if (heat_add_next_loop > 0) {
      heat_add = heat_add_next_loop;
      heat_add_next_loop = 0;
    }

    for (let tile of _deps.game.active_tiles_2d) {
      if (tile.activated && tile.part) {
        if (tile.ticks !== 0 && tile.ticks < no_change_ticks) {
          no_change_ticks = tile.ticks;
        }
        let tile_part = tile.part;
        if (tile_part.category === 'cell') {
          if (tile.ticks !== 0) {
            power_add += tile.power;
            heat_add += tile.heat;
            tile.setTicks(tile.ticks - 1);
            trackTile(tickResult, tile, { ticks: tile.ticks });

            if (tile.reflectors.length) {
              for (let tile_reflector of tile.reflectors) {
                tile_reflector.setTicks(tile_reflector.ticks - 1);
                trackTile(tickResult, tile_reflector, { ticks: tile_reflector.ticks });

                if (tile_reflector.ticks === 0) {
                  if (
                    _deps.game.auto_buy_disabled !== true &&
                    tile_reflector.part.perpetual &&
                    _deps.game.current_money >= tile_reflector.part.cost
                  ) {
                    _deps.game.current_money -= tile_reflector.part.cost;
                    onMoneyChange(tickResult, _deps.game.current_money);
                    tile_reflector.setTicks(tile_reflector.part.ticks);
                    trackTile(tickResult, tile_reflector, { ticks: tile_reflector.ticks });
                  } else {
                    const idx = tileIndex(tile_reflector, _deps.game.max_cols);
                    pushVisualClass(tickResult, idx, ['exploding'], []);
                    removePartSim(tile_reflector, _deps.game, {
                      onMoneyChange: (m) => onMoneyChange(tickResult, m),
                    });
                    pushPartRemoved(tickResult, idx);
                  }
                }
              }
            }

            if (tile.ticks === 0) {
              if (tile_part.part.type === 'protium') {
                _deps.runtime.protium_particles += tile_part.cell_count;
                _deps.game.update_cell_power();
              }

              if (
                _deps.game.auto_buy_disabled !== true &&
                tile_part.perpetual &&
                _deps.game.current_money >= tile_part.cost * 1.5
              ) {
                _deps.game.current_money -= tile_part.cost * 1.5;
                onMoneyChange(tickResult, _deps.game.current_money);
                tile.setTicks(tile_part.ticks);
                trackTile(tickResult, tile, { ticks: tile.ticks });
              } else {
                pushVisualClass(tickResult, tileIndex(tile, _deps.game.max_cols), ['spent'], []);
                do_update = true;
              }
            }
          }
        }

        if (tile_part.containment) {
          if (tile_part.id === 'coolant_cell6') {
            tile.setHeat_contained(tile.heat_contained + tile.heat / 2);
            power_add += tile.heat / 2;
          } else {
            tile.setHeat_contained(tile.heat_contained + tile.heat);
          }
          trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
        }

        if (tile_part.category === 'particle_accelerator') {
          if (tile.heat_contained) {
            let lower_heat = Math.min(tile.heat_contained, tile_part.ep_heat);
            let ep_chance_percent = lower_heat / tile_part.part.base_ep_heat;
            let ep_chance =
              (Math.log(lower_heat) / Math.pow(10, 5 - tile_part.part.level)) * ep_chance_percent;
            let ep_gain = 0;
            tile.display_chance = ep_chance * 100;
            tile.display_chance_percent_of_total = (lower_heat / tile_part.ep_heat) * 100;

            ep_chance_add += ep_chance;

            if (ep_chance > 1) {
              ep_gain = Math.floor(ep_chance);
              ep_chance -= ep_gain;
            }

            if (ep_chance > Math.random()) {
              ep_gain++;
            }

            if (ep_gain > 0) {
              _deps.game.exotic_particles += ep_gain;
              setStat(tickResult, 'exotic_particles', _deps.game.exotic_particles);
            }
          }
        }

        if (tile_part.transfer && tile.containments.length > 0) {
          if (tile_part.category === 'heat_inlet') {
            active_inlets.push(tile);
          } else if (tile_part.category === 'heat_exchanger') {
            active_exchangers.push(tile);
          } else if (tile_part.category === 'heat_outlet') {
            active_outlets.push(tile);
          }
        }

        if (tile.part.id === 'capacitor6') {
          active_extreme_capacitor.push(tile);
        }
      }
    }

    for (let tile of active_inlets) {
      for (let tile_containment of tile.containments) {
        let transfer_heat = Math.min(tile.transfer, tile_containment.heat_contained);

        tile_containment.setHeat_contained(tile_containment.heat_contained - transfer_heat);
        trackTile(tickResult, tile_containment, { heat_contained: tile_containment.heat_contained });
        heat_add += transfer_heat;
      }
    }

    _deps.game.current_heat += heat_add;
    setStat(tickResult, 'heat_add', heat_add);

    let max_shared_heat;
    if (_deps.game.heat_controlled && _deps.game.upgrade_objects['heat_control_operator'].level > 0) {
      if (_deps.game.current_heat > _deps.runtime.max_heat) {
        max_shared_heat = (_deps.game.current_heat - _deps.runtime.max_heat) / _deps.runtime.stat_outlet;
      } else {
        max_shared_heat = 0;
      }
    } else {
      max_shared_heat = _deps.game.current_heat / _deps.runtime.stat_outlet;
    }

    for (let tile of active_exchangers) {
      let max_heat_transfer = tile.transfer;
      let total_containment = tile.part.containment;
      let total_containment_heat = tile.heat_contained;

      for (let tile_containment of tile.containments) {
        if (tile_containment.part.id === 'coolant_cell6') {
          total_containment += tile_containment.part.containment * 2;
        } else if (tile_containment.part.part.category === 'vent') {
          total_containment += tile_containment.part.containment + tile_containment.part.vent;
        } else {
          total_containment += tile_containment.part.containment;
        }

        total_containment_heat += tile_containment.heat_contained;
      }

      let target_percent = total_containment_heat / total_containment;

      for (let tile_containment of tile.containments) {
        let tile_containment_containment;
        if (tile_containment.part.id === 'coolant_cell6') {
          tile_containment_containment = tile_containment.part.containment * 2;
        } else if (tile_containment.part.part.category === 'vent') {
          tile_containment_containment =
            tile_containment.part.containment + tile_containment.part.vent;
        } else {
          tile_containment_containment = tile_containment.part.containment;
        }

        let tile_containment_percent = tile_containment.heat_contained / tile_containment_containment;

        if (tile_containment_percent > target_percent) {
          let transfer_heat = Math.min(
            (tile_containment_percent - target_percent) * total_containment_heat,
            max_heat_transfer,
            tile_containment.heat_contained
          );

          if (transfer_heat >= 1) {
            tile_containment.setHeat_contained(tile_containment.heat_contained - transfer_heat);
            trackTile(tickResult, tile_containment, { heat_contained: tile_containment.heat_contained });
            tile.setHeat_contained(tile.heat_contained + transfer_heat);
            trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
          }
        }
      }

      for (let tile_containment of tile.containments) {
        let transfer_heat = 0;
        let tile_containment_containment;

        if (tile_containment.part.id === 'coolant_cell6') {
          tile_containment_containment = tile_containment.part.containment * 2;
        } else if (tile_containment.part.part.category === 'vent') {
          tile_containment_containment =
            tile_containment.part.containment + tile_containment.part.vent;
        } else {
          tile_containment_containment = tile_containment.part.containment;
        }

        let tile_containment_percent = tile_containment.heat_contained / tile_containment_containment;

        if (tile_containment_percent < target_percent) {
          transfer_heat = (target_percent - tile_containment_percent) * tile_containment_containment;
        }

        if (
          tile_containment.part.part.category === 'vent' &&
          transfer_heat < tile_containment.part.vent - tile_containment.heat_contained
        ) {
          transfer_heat = tile_containment.part.vent - tile_containment.heat_contained;
        }

        transfer_heat = Math.min(transfer_heat, max_heat_transfer, tile.heat_contained);

        if (transfer_heat >= 1) {
          if (tile_containment.part.id === 'coolant_cell6') {
            tile_containment.setHeat_contained(tile_containment.heat_contained + transfer_heat / 2);
            power_add += transfer_heat / 2;
          } else {
            tile_containment.setHeat_contained(tile_containment.heat_contained + transfer_heat);
          }
          trackTile(tickResult, tile_containment, { heat_contained: tile_containment.heat_contained });

          tile.setHeat_contained(tile.heat_contained - transfer_heat);
          trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
        }
      }
    }

    for (let tile of active_outlets) {
      let max_heat_transfer = tile.transfer;

      let shared_heat = Math.min(
        max_heat_transfer,
        (_deps.game.current_heat / _deps.runtime.stat_outlet) * max_heat_transfer,
        max_shared_heat * max_heat_transfer
      );

      for (let tile_containment of tile.containments) {
        if (tile_containment.part.id === 'coolant_cell6') {
          tile_containment.setHeat_contained(tile_containment.heat_contained + shared_heat / 2);
          power_add += shared_heat / 2;
        } else {
          if (_deps.game.heat_outlet_controlled && tile_containment.vent) {
            shared_heat = Math.min(
              shared_heat,
              tile_containment.vent - tile_containment.heat_contained
            );
          }
          tile_containment.setHeat_contained(tile_containment.heat_contained + shared_heat);
        }
        trackTile(tickResult, tile_containment, { heat_contained: tile_containment.heat_contained });

        heat_remove += shared_heat;
      }
    }

    _deps.game.current_heat -= heat_remove;

    if (_deps.game.current_heat > 0) {
      if (_deps.game.current_heat <= _deps.runtime.max_heat) {
        reduce_heat = _deps.runtime.max_heat / 10000;
      } else {
        reduce_heat = (_deps.game.current_heat - _deps.runtime.max_heat) / 20;
        if (reduce_heat < _deps.runtime.max_heat / 10000) {
          reduce_heat = _deps.runtime.max_heat / 10000;
        }

        for (let tile of _deps.game.active_tiles_2d) {
          if (tile.activated && tile.part && tile.part.containment) {
            if (tile.part.id === 'coolant_cell6') {
              tile.setHeat_contained(
                tile.heat_contained + reduce_heat / _deps.game.active_tiles_2d.length / 2
              );
              power_add += reduce_heat / _deps.game.active_tiles_2d.length / 2;
            } else {
              tile.setHeat_contained(
                tile.heat_contained + reduce_heat / _deps.game.active_tiles_2d.length
              );
            }
            trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
          }
        }
      }

      setStat(tickResult, 'auto_heat_reduce', reduce_heat);
      _deps.game.current_heat -= reduce_heat;
    }

    if (_deps.game.heat_power_multiplier && _deps.game.current_heat > 1000) {
      power_add *=
        1 +
        _deps.game.heat_power_multiplier *
          (Math.log(_deps.game.current_heat) / Math.log(1000) / 100);
    }

    _deps.runtime.current_power += power_add;
    setStat(tickResult, 'power_add', power_add);

    if (_deps.tile_queue.length) {
      let processed = 0;
      for (let tile of _deps.tile_queue) {
        if (!tile.part || tile.activated) {
          processed += 1;
          continue;
        }

        if (_deps.game.current_money >= tile.part.cost) {
          processed += 1;
          _deps.game.current_money -= tile.part.cost;
          onMoneyChange(tickResult, _deps.game.current_money);
          tile.activated = true;
          const idx = tileIndex(tile, _deps.game.max_cols);
          pushVisualClass(tickResult, idx, [], ['disabled']);
          trackTile(tickResult, tile, { activated: true });
          do_update = true;
        } else {
          if (processed) {
            _deps.tile_queue.splice(0, processed);
          }
          break;
        }
      }
    }

    for (let tile of _deps.game.active_tiles_2d) {
      if (tile.activated && tile.part && tile.part.containment) {
        if (tile.part.vent) {
          let vent_reduce;
          if (tile.part.id === 'vent6') {
            vent_reduce = Math.min(tile.vent, tile.heat_contained, _deps.runtime.current_power);
            _deps.runtime.current_power -= vent_reduce;
          } else {
            vent_reduce = Math.min(tile.vent, tile.heat_contained);
          }

          tile.setHeat_contained(tile.heat_contained - vent_reduce);
          trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
        }

        if (tile.part.id === 'particle_accelerator6') {
          var pa_transfer = Math.min(
            tile.part.transfer,
            _deps.runtime.current_power,
            _deps.game.current_heat
          );

          if (pa_transfer && pa_transfer > 0) {
            _deps.runtime.current_power -= pa_transfer;
            _deps.game.current_heat -= pa_transfer;
            tile.setHeat_contained(tile.heat_contained + pa_transfer);
            trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
          }
        }

        if (tile.heat_contained > tile.part.containment) {
          if (
            _deps.game.auto_buy_disabled !== true &&
            tile.heat <= 0 &&
            tile.part.category === 'capacitor' &&
            _deps.game.upgrade_objects['perpetual_capacitors'].level > 0 &&
            _deps.game.current_money >= tile.part.cost * 10
          ) {
            _deps.game.current_money -= tile.part.cost * 10;
            onMoneyChange(tickResult, _deps.game.current_money);
            heat_add_next_loop += tile.heat_contained;
            tile.setHeat_contained(0);
            trackTile(tickResult, tile, { heat_contained: 0 });
          } else {
            if (tile.part.category === 'particle_accelerator') {
              meltdown = true;
            }

            const idx = tileIndex(tile, _deps.game.max_cols);
            pushVisualClass(tickResult, idx, ['exploding'], []);
            do_update = true;
            removePartSim(tile, _deps.game, {
              onMoneyChange: (m) => onMoneyChange(tickResult, m),
            });
            pushPartRemoved(tickResult, idx);
          }
        }
      }
    }

    if (!_deps.game.auto_sell_disabled) {
      sell_amount = Math.ceil(_deps.runtime.max_power * _deps.game.auto_sell_multiplier);
      if (sell_amount) {
        let power_sell_percent;
        if (sell_amount > _deps.runtime.current_power) {
          power_sell_percent = _deps.runtime.current_power / sell_amount;
          sell_amount = _deps.runtime.current_power;
        } else {
          power_sell_percent = 1;
        }

        _deps.runtime.current_power -= sell_amount;
        _deps.game.current_money += sell_amount;
        setStat(tickResult, 'money_add', sell_amount);
        onMoneyChange(tickResult, _deps.game.current_money);

        for (tile of active_extreme_capacitor) {
          tile.setHeat_contained(
            tile.heat_contained +
              sell_amount * _deps.game.auto_sell_multiplier * power_sell_percent * 0.5
          );
          trackTile(tickResult, tile, { heat_contained: tile.heat_contained });
        }
      }
    }

    if (_deps.runtime.current_power > _deps.runtime.max_power) {
      _deps.runtime.current_power = _deps.runtime.max_power;
    }

    if (_deps.game.current_heat < 0) {
      _deps.game.current_heat = 0;
    }

    if (meltdown) {
      _deps.game.current_heat = _deps.runtime.max_heat * 2 + 1;
    }

    if (meltdown || _deps.game.current_heat > _deps.runtime.max_heat * 2) {
      melting_down = true;
      _deps.game.has_melted_down = true;

      const MELTDOWN_EXPLOSION_CAP = 16;
      const meltingTiles = _deps.game.active_tiles_2d.filter((t) => t.part);
      const explosionSet = new Set();

      if (meltingTiles.length <= MELTDOWN_EXPLOSION_CAP) {
        for (const t of meltingTiles) {
          explosionSet.add(tileIndex(t, _deps.game.max_cols));
        }
      } else {
        const shuffled = meltingTiles.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        for (let i = 0; i < MELTDOWN_EXPLOSION_CAP; i++) {
          explosionSet.add(tileIndex(shuffled[i], _deps.game.max_cols));
        }
      }

      for (tile of _deps.game.active_tiles_2d) {
        if (tile.part) {
          do_update = true;
          const idx = tileIndex(tile, _deps.game.max_cols);
          if (explosionSet.has(idx)) {
            pushVisualClass(tickResult, idx, ['exploding'], []);
          } else {
            pushVisualClass(tickResult, idx, ['spent'], []);
          }
          removePartSim(tile, _deps.game, {
            onMoneyChange: (m) => onMoneyChange(tickResult, m),
          });
          pushPartRemoved(tickResult, idx);
        }
      }
    }

    if (do_update) {
      tickResult.flags.rebuildTopology = true;
      const topoStats = rebuildTopology(_deps.game, _deps.runtime);
      Object.assign(tickResult.stats, topoStats);
      pruneTileQueue(_deps.tile_queue);
    }

    setStat(tickResult, 'current_heat', _deps.game.current_heat);
    setStat(tickResult, 'current_power', _deps.runtime.current_power);

    if (_deps.tooltip_update !== null) {
      _deps.tooltip_update();
    }

    if (!was_melting_down && melting_down) {
      tickResult.flags.save = true;
      tickResult.flags.meltingDown = true;
    } else if (was_melting_down && !melting_down) {
      tickResult.flags.meltingDown = false;
    }

    if (melting_down) {
      was_melting_down = true;
    } else {
      was_melting_down = false;
    }

    game_stat_prediction.heat_add = heat_add;
    game_stat_prediction.heat_add_next_loop = heat_add_next_loop;
    game_stat_prediction.heat_remove = heat_remove;
    game_stat_prediction.reduce_heat = reduce_heat;
    game_stat_prediction.power_add = power_add;
    game_stat_prediction.sell_amount = sell_amount;
    game_stat_prediction.ep_chance_add = ep_chance_add;
    game_stat_prediction.no_change_ticks = no_change_ticks - 1;

    loop_timing = performance.now() - loop_start;

    _deps.onTickResult(tickResult);
  };

  return {
    game_loop,
    get loop_timeout() {
      return loop_timeout;
    },
    set loop_timeout(v) {
      loop_timeout = v;
    },
    get last_tick_time() {
      return last_tick_time;
    },
    set last_tick_time(v) {
      last_tick_time = v;
    },
    get dtime() {
      return dtime;
    },
    set dtime(v) {
      dtime = v;
    },
    game_stat_prediction,
  };
}
