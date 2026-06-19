import { addProperty } from '../lib/properties.js';

export class Game {
  constructor() {
    this.ui;

    this.version = '1.3.2';
    this.base_cols = 14;
    this.base_rows = 11;
    this.max_cols = 35;
    this.max_rows = 32;
    this.debug = false;
    this.save_debug = false;
    this.offline_tick = true;
    this.base_loop_wait = 1000;
    this.base_power_multiplier = 1;
    this.base_heat_multiplier = 4;
    this.base_manual_heat_reduce = 1;
    this.upgrade_max_level = 32;
    this.base_max_heat = 1000;
    this.base_max_power = 100;
    this.base_money = 10;
    this.save_interval = 60000;

    this.current_heat;
    this.tiles = [];
    this.tiles_2d = [];
    this.active_tiles = [];
    this.active_tiles_2d = [];
    this.loop_wait;
    this.heat_power_multiplier;
    this.heat_controlled;
    this.manual_heat_reduce;
    this.auto_sell_multiplier;
    this.transfer_plating_multiplier;
    this.transfer_capacitor_multiplier;
    this.vent_plating_multiplier;
    this.vent_capacitor_multiplier;
    this.altered_max_power;
    this.altered_max_heat;
    this.stats_power;
    this.stats_cash = 0;
    this.paused = false;
    this.auto_sell_disabled = false;
    this.auto_buy_disabled = false;
    this.has_melted_down = false;
    this.current_money = 0;
    this.exotic_particles = 0;
    this.current_exotic_particles = 0;

    this.part_objects_array = [];
    this.part_objects = {};
    this.upgrade_objects_array = [];
    this.upgrade_objects = {};

    this.sold_power = false;
    this.sold_heat = false;
  }

  update_active_tiles() {
    var arow;
    this.active_tiles.length = 0;
    this.active_tiles_2d.length = 0;
    for (var ri = 0; ri < this.rows; ri++) {
      var row = this.tiles[ri];
      arow = [];

      for (var ci = 0; ci < this.cols; ci++) {
        var tile = row[ci];
        arow.push(tile);
        this.active_tiles_2d.push(tile);
      }
      this.active_tiles.push(row);
    }
  }

  set_active_tiles(row, col) {
    this._rows = row;
    this._cols = col;
    this.update_active_tiles();
  }

  get rows() {
    return this._rows;
  }
  set rows(length) {
    this._rows = length;
    this.update_active_tiles();
    if (this.onDimensionsChange) {
      this.onDimensionsChange(this);
    }
  }

  get cols() {
    return this._cols;
  }
  set cols(length) {
    this._cols = length;
    this.update_active_tiles();
    if (this.onDimensionsChange) {
      this.onDimensionsChange(this);
    }
  }
}

Game.prototype.addProperty = addProperty;

export function setDefaults(game, state) {
  game.current_heat = 0;
  state.current_power = 0;
  game.current_money = game.base_money;
  game.cols = game.base_cols;
  game.rows = game.base_rows;
  state.max_heat = game.base_max_heat;
  game.auto_sell_multiplier = 0;
  state.max_power = game.base_max_power;
  game.loop_wait = game.base_loop_wait;
  state.power_multiplier = game.base_power_multiplier;
  state.heat_multiplier = game.base_heat_multiplier;
  game.manual_heat_reduce = game.base_manual_heat_reduce;
  game.vent_capacitor_multiplier = 0;
  game.vent_plating_multiplier = 0;
  game.transfer_capacitor_multiplier = 0;
  game.transfer_plating_multiplier = 0;
  game.heat_power_multiplier = 0;
  game.heat_controlled = 0;
  game.time_flux = true;
  game.heat_outlet_controlled = 0;
  game.altered_max_heat = game.base_max_heat;
  game.altered_max_power = game.base_max_power;
  state.protium_particles = 0;
}
