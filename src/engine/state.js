export const state = {
  current_power: 0,
  max_heat: 0,
  max_power: 0,
  power_multiplier: 0,
  heat_multiplier: 0,
  protium_particles: 0,
  total_exotic_particles: 0,
  transfer_multiplier: 0,
  vent_multiplier: 0,
  current_objective: 0,
  last_tick_time: null,
  loop_timeout: null,
  save_timeout: null,
  tile_queue: [],
  clicked_part: null,
  heat_add_next_loop: 0,
  was_melting_down: false,
  dtime: 0,
  loop_timing: 0,
};

export const active_inlets = [];
export const active_exchangers = [];
export const active_outlets = [];
export const active_extreme_capacitor = [];
export const active_cells = [];

export const game_stat_prediction = {
  heat_add: 0,
  heat_add_next_loop: 0,
  heat_remove: 0,
  reduce_heat: 0,
  power_add: 0,
  sell_amount: 0,
  ep_chance_add: 0,
  no_change_ticks: Infinity,
};

export const last_data_set = [];
export const current_data_set = [];

export const single_cell_description = 'Produces %power power and %heat heat per tick. Lasts for %ticks ticks.';
export const multi_cell_description = 'Acts as %count %type cells. Produces %power power and %heat heat per tick.';
