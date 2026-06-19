import { addProperty } from '../lib/properties.js';

let emit = () => {};
let transfer_multiplier = 0;
let vent_multiplier = 0;

export function setTileEmit(fn) {
  emit = fn;
}

export function setTileMultipliers(transfer, vent) {
  transfer_multiplier = transfer;
  vent_multiplier = vent;
}

export class Tile {
  constructor(row, col) {
    this.part = null;
    this.heat = 0;
    this.display_power = null;
    this.display_heat = null;
    this.power = 0;
    this.containments = [];
    this.cells = [];
    this.reflectors = [];
    this.activated = false;
    this.row = row;
    this.col = col;
    this.enabled = false;
    this.updated = false;

    this.display_chance = 0;
    this.display_chance_percent_of_total = 0;

    this.addProperty('heat_contained', 0);
    this.addProperty('ticks', 0);
  }

  get vent() {
    if (this.part.vent) {
      return this.part.vent * (1 + vent_multiplier / 100);
    }
  }

  get transfer() {
    if (this.part.transfer) {
      return this.part.transfer * (1 + transfer_multiplier / 100);
    }
  }

  disable() {
    this.enabled = false;
    emit('evt', 'tile_disabled', this);
  }

  enable() {
    this.enabled = true;
    emit('evt', 'tile_enabled', this);
  }
}

Tile.prototype.addProperty = addProperty;
