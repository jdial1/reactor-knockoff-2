import { addProperty } from '../lib/properties.js';

export class Part {
  constructor(part) {
    this.part = part;
    this.id = part.id;
    this.category = part.category;
    this.heat = part.heat;
    this.power = part.power;
    this.base_heat = part.base_heat;
    this.base_power = part.base_power;
    this.heat_multiplier = part.base_heat_multiplier;
    this.power_multiplier = part.base_power_multiplier;
    this.power_increase = part.base_power_increase;
    this.heat_increase = part.base_heat_increase;
    this.ticks = part.base_ticks;
    this.containment = part.base_containment;
    this.vent = part.base_vent;
    this.reactor_power = part.base_reactor_power;
    this.reactor_heat = part.base_reactor_heat;
    this.transfer = part.base_transfer;
    this.range = part.base_range;
    this.ep_heat = part.base_ep_heat;
    this.erequires = part.erequires || null;
    this.cost = part.base_cost;
    this.perpetual = false;
    this.description = '';
    this.sells = 0;
    this.auto_sell = 0;
    this.cell_count = part.cell_count || 0;
    this.cell_multiplier = part.cell_multiplier || 0;
    this.pulse_multiplier = part.pulse_multiplier || 0;
    this.pulses = part.cell_count * part.pulse_multiplier;

    this.addProperty('affordable', false);
  }

  updateDescription(tile, game, fmt, singleCellDescription, multiCellDescription, transferMultiplier, ventMultiplier) {
    var description = this.part.base_description
      .replace(/%single_cell_description/, singleCellDescription)
      .replace(/%multi_cell_description/, multiCellDescription)
      .replace(/%power_increase/, fmt(this.power_increase))
      .replace(/%heat_increase/, fmt(this.heat_increase))
      .replace(/%reactor_power/, fmt(this.reactor_power))
      .replace(/%reactor_heat/, fmt(this.reactor_heat))
      .replace(/%ticks/, fmt(this.ticks))
      .replace(/%containment/, fmt(this.containment))
      .replace(/%ep_heat/, fmt(this.ep_heat))
      .replace(/%range/, fmt(this.range))
      .replace(/%count/, [1, 2, 4][this.part.level - 1])
      .replace(/%power/, fmt(this.power))
      .replace(/%heat/, fmt(this.heat));

    if (tile) {
      description = description
        .replace(/%transfer/, fmt(this.transfer * (1 + transferMultiplier / 100)))
        .replace(/%vent/, fmt(this.vent * (1 + ventMultiplier / 100)));
    } else {
      description = description
        .replace(/%transfer/, fmt(this.transfer))
        .replace(/%vent/, fmt(this.vent));
    }

    if (this.part.level > 1) {
      description = description.replace(/%type/, game.part_objects[this.part.type + 1].part.title);
    }

    this.description = description;
  }
}

Part.prototype.addProperty = addProperty;
